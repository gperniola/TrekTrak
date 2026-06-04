-- Permette a un utente autenticato (anche non ancora membro) di leggere la PROPRIA riga,
-- così il client può distinguere "devo scegliere username" da "sono già membro".
-- Si combina in OR con members_select: i membri leggono tutti, ognuno legge comunque sé stesso.
create policy members_select_self on public.members
  for select using (id = auth.uid());
