-- Rider-facing in-app notifications.
-- These are separate from the generic outbound notifications queue so riders
-- can keep read/unread inbox state in the dashboard.

create table rider_notifications (
  id uuid primary key default gen_random_uuid(),
  rider_profile_id uuid not null references profiles(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  kind text not null check (
    kind in (
      'assignment',
      'order_status',
      'delivery_cancelled',
      'delivery_details',
      'payment_status'
    )
  ),
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index rider_notifications_rider_created_idx
  on rider_notifications(rider_profile_id, created_at desc);
create index rider_notifications_rider_unread_idx
  on rider_notifications(rider_profile_id, created_at desc)
  where read_at is null;
create index rider_notifications_order_idx on rider_notifications(order_id);

alter table rider_notifications enable row level security;
alter table rider_notifications replica identity full;

create policy "rider read own notifications"
  on rider_notifications for select
  using (
    current_role_kind() = 'rider'
    and rider_profile_id = auth.uid()
  );

create policy "rider update own notification reads"
  on rider_notifications for update
  using (
    current_role_kind() = 'rider'
    and rider_profile_id = auth.uid()
  )
  with check (
    current_role_kind() = 'rider'
    and rider_profile_id = auth.uid()
  );

grant select, update(read_at) on rider_notifications to authenticated;

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rider_notifications'
  ) then
    execute 'alter publication supabase_realtime add table public.rider_notifications';
  end if;
end $$;

create or replace function rider_notification_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pending' then 'Pending'
    when 'accepted' then 'Accepted'
    when 'preparing' then 'Preparing'
    when 'ready' then 'Ready'
    when 'out_for_delivery' then 'Out for delivery'
    when 'completed' then 'Completed'
    when 'cancelled' then 'Cancelled'
    when 'rejected' then 'Rejected'
    else initcap(replace(p_status, '_', ' '))
  end
$$;

create or replace function enqueue_rider_notification(
  p_rider_profile_id uuid,
  p_order_id uuid,
  p_kind text,
  p_title text,
  p_body text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into rider_notifications (
    rider_profile_id,
    order_id,
    kind,
    title,
    body,
    metadata
  )
  values (
    p_rider_profile_id,
    p_order_id,
    p_kind,
    p_title,
    p_body,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function enqueue_rider_notification(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function notify_rider_assignment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order orders%rowtype;
begin
  if tg_op = 'UPDATE'
    and new.rider_profile_id is not distinct from old.rider_profile_id then
    return new;
  end if;

  select * into v_order from orders where id = new.order_id;
  if not found or v_order.service_mode <> 'delivery' then
    return new;
  end if;

  perform enqueue_rider_notification(
    new.rider_profile_id,
    new.order_id,
    'assignment',
    'New delivery assigned',
    format(
      'Order %s for %s is assigned to you.',
      v_order.short_code,
      v_order.customer_name
    ),
    jsonb_build_object(
      'short_code', v_order.short_code,
      'status', v_order.status,
      'assigned_at', new.assigned_at
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_rider_assignment_change_trigger on rider_assignments;
create trigger notify_rider_assignment_change_trigger
after insert or update of rider_profile_id on rider_assignments
for each row execute function notify_rider_assignment_change();

create or replace function notify_rider_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_profile_id uuid;
  v_kind text := 'order_status';
  v_title text := 'Order status updated';
  v_body text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if new.service_mode <> 'delivery' then
    return new;
  end if;

  select rider_profile_id
  into v_rider_profile_id
  from rider_assignments
  where order_id = new.id;

  if v_rider_profile_id is null then
    return new;
  end if;

  if new.status = 'cancelled' then
    v_kind := 'delivery_cancelled';
    v_title := 'Delivery cancelled';
    v_body := format('Order %s was cancelled.', new.short_code);
  else
    v_body := format(
      'Order %s moved from %s to %s.',
      new.short_code,
      rider_notification_status_label(old.status::text),
      rider_notification_status_label(new.status::text)
    );
  end if;

  perform enqueue_rider_notification(
    v_rider_profile_id,
    new.id,
    v_kind,
    v_title,
    v_body,
    jsonb_build_object(
      'short_code', new.short_code,
      'from_status', old.status,
      'to_status', new.status,
      'reason', new.rejected_reason
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_rider_order_status_change_trigger on orders;
create trigger notify_rider_order_status_change_trigger
after update of status on orders
for each row execute function notify_rider_order_status_change();

create or replace function notify_rider_delivery_details_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_profile_id uuid;
  v_short_code text;
  v_changed text[];
begin
  v_changed := array_remove(array[
    case when new.street is distinct from old.street then 'street' end,
    case when new.barangay is distinct from old.barangay then 'barangay' end,
    case when new.city is distinct from old.city then 'city' end,
    case when new.landmark is distinct from old.landmark then 'landmark' end,
    case when new.delivery_notes is distinct from old.delivery_notes then 'delivery_notes' end,
    case when new.lat is distinct from old.lat or new.lng is distinct from old.lng then 'submitted_pin' end,
    case when new.google_place_id is distinct from old.google_place_id then 'google_place_id' end,
    case when new.detected_lat is distinct from old.detected_lat
       or new.detected_lng is distinct from old.detected_lng
       or new.detected_address is distinct from old.detected_address
      then 'detected_location'
    end
  ], null);

  if coalesce(array_length(v_changed, 1), 0) = 0 then
    return new;
  end if;

  select ra.rider_profile_id, o.short_code
  into v_rider_profile_id, v_short_code
  from rider_assignments ra
  join orders o on o.id = ra.order_id
  where ra.order_id = new.order_id
    and o.service_mode = 'delivery';

  if v_rider_profile_id is null then
    return new;
  end if;

  perform enqueue_rider_notification(
    v_rider_profile_id,
    new.order_id,
    'delivery_details',
    'Delivery details updated',
    format('Order %s delivery details were updated. Review the address, notes, and pin.', v_short_code),
    jsonb_build_object(
      'short_code', v_short_code,
      'changed_fields', v_changed
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_rider_delivery_details_change_trigger on delivery_addresses;
create trigger notify_rider_delivery_details_change_trigger
after update on delivery_addresses
for each row execute function notify_rider_delivery_details_change();

create or replace function notify_rider_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rider_profile_id uuid;
  v_short_code text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select ra.rider_profile_id, o.short_code
  into v_rider_profile_id, v_short_code
  from rider_assignments ra
  join orders o on o.id = ra.order_id
  where ra.order_id = new.order_id
    and o.service_mode = 'delivery';

  if v_rider_profile_id is null then
    return new;
  end if;

  perform enqueue_rider_notification(
    v_rider_profile_id,
    new.order_id,
    'payment_status',
    'Payment status changed',
    format(
      'Order %s payment changed from %s to %s.',
      v_short_code,
      rider_notification_status_label(old.status::text),
      rider_notification_status_label(new.status::text)
    ),
    jsonb_build_object(
      'short_code', v_short_code,
      'method', new.method,
      'from_status', old.status,
      'to_status', new.status
    )
  );

  return new;
end;
$$;

drop trigger if exists notify_rider_payment_status_change_trigger on payments;
create trigger notify_rider_payment_status_change_trigger
after update of status on payments
for each row execute function notify_rider_payment_status_change();

notify pgrst, 'reload schema';
