-- Staff auth users own profiles through profiles.id -> auth.users(id) with
-- ON DELETE CASCADE. Historical operations rows must not block that cascade.

alter table orders
  drop constraint if exists orders_accepted_by_fk,
  add constraint orders_accepted_by_fk
    foreign key (accepted_by_profile_id) references profiles(id)
    on delete set null;

alter table orders
  drop constraint if exists orders_placed_by_profile_id_fkey,
  add constraint orders_placed_by_profile_id_fkey
    foreign key (placed_by_profile_id) references profiles(id)
    on delete set null;

alter table order_status_events
  drop constraint if exists order_status_events_actor_fk,
  add constraint order_status_events_actor_fk
    foreign key (actor_profile_id) references profiles(id)
    on delete set null;

alter table payments
  drop constraint if exists payments_recorded_by_fk,
  add constraint payments_recorded_by_fk
    foreign key (recorded_by_profile_id) references profiles(id)
    on delete set null;

alter table audit_logs
  drop constraint if exists audit_logs_actor_profile_id_fkey,
  add constraint audit_logs_actor_profile_id_fkey
    foreign key (actor_profile_id) references profiles(id)
    on delete set null;

alter table staff_invitations
  alter column invited_by_profile_id drop not null,
  drop constraint if exists staff_invitations_invited_by_profile_id_fkey,
  add constraint staff_invitations_invited_by_profile_id_fkey
    foreign key (invited_by_profile_id) references profiles(id)
    on delete set null,
  drop constraint if exists staff_invitations_accepted_by_profile_id_fkey,
  add constraint staff_invitations_accepted_by_profile_id_fkey
    foreign key (accepted_by_profile_id) references profiles(id)
    on delete set null;

alter table rider_assignments
  drop constraint if exists rider_assignments_rider_profile_id_fkey,
  add constraint rider_assignments_rider_profile_id_fkey
    foreign key (rider_profile_id) references profiles(id)
    on delete cascade;
