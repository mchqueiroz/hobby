-- Etapa 9: novo status "pausei" em activity.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.activity'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%status%'
  loop execute format('alter table public.activity drop constraint %I', c); end loop;
end $$;
alter table public.activity add constraint activity_status_check check (status in ('quero','andamento','concluido','abandonei','pausei'));
