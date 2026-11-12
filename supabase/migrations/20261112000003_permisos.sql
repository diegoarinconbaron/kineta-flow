-- Las funciones solo las ejecutan usuarios autenticados
revoke execute on function public.mis_negocios() from anon, public;
grant execute on function public.mis_negocios() to authenticated;
revoke execute on function public.resumen_negocio(uuid, int) from anon, public;
grant execute on function public.resumen_negocio(uuid, int) to authenticated;
revoke execute on function public.activar_catalogo(uuid) from anon, public;
grant execute on function public.activar_catalogo(uuid) to authenticated;
