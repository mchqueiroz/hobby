-- Etapa 7: quem me segue pode ser lido por mim (para "novos seguidores").
-- Antes só era possível ler as linhas em que EU era o seguidor.
-- Efeito: cada pessoa vê a lista de quem a segue (todos têm perfil público); nada além disso.
create policy follows_select_incoming on public.follows for select to authenticated
  using (followee_id = (select auth.uid()));
