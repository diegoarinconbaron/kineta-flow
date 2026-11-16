-- Registra qué interpretó cada respuesta del asistente: el modelo de lenguaje (claude) o el motor de reglas
alter table public.mensajes add column if not exists motor text check (motor in ('claude', 'reglas'));
