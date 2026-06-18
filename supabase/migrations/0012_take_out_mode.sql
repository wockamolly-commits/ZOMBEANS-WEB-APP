-- Add a 'take_out' service mode.
-- The cafe is counter-based: customers either dine in or grab their order
-- at the counter/cashier. Take-out needs no table and no scheduled slot.
-- (Enum value is added in its own migration so it is committed before the
--  place_order function below references it.)

alter type service_mode add value if not exists 'take_out' after 'dine_in';
