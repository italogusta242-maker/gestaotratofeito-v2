/**
 * Traduz mensagens de erro do Supabase Auth e Postgres para PT-BR.
 * Se não conhecer, devolve a mensagem original.
 */

type AnyError = { message?: string; code?: string; error_description?: string } | Error | string | null | undefined;

const AUTH_TRANSLATIONS: Record<string, string> = {
  "Invalid login credentials": "Email ou senha incorretos",
  "Invalid credentials": "Email ou senha incorretos",
  "Email not confirmed": "Email ainda não confirmado",
  "User already registered": "Este email já está cadastrado",
  "Password should be at least 6 characters": "A senha precisa ter no mínimo 6 caracteres",
  "Signup requires a valid password": "Senha inválida",
  "Unable to validate email address: invalid format": "Formato de email inválido",
  "Email rate limit exceeded": "Muitas tentativas. Tente novamente em alguns minutos",
  "For security purposes, you can only request this after 60 seconds":
    "Por segurança, aguarde 60 segundos antes de tentar novamente",
  "Token has expired or is invalid": "Sessão expirada. Faça login novamente",
  "New password should be different from the old password": "A nova senha deve ser diferente da atual",
};

// Postgres error codes que interessam
const PG_CODE_TRANSLATIONS: Record<string, string> = {
  "23505": "Este registro já existe (valor duplicado)",
  "23503": "Não é possível remover: existe(m) registro(s) vinculado(s)",
  "23502": "Campo obrigatório não preenchido",
  "23514": "Valor não permitido para este campo",
  "42501": "Você não tem permissão para esta operação",
  "PGRST116": "Registro não encontrado",
  "PGRST301": "Sessão inválida",
};

function extractMessage(err: AnyError): string {
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return err.message || err.error_description || "Erro desconhecido";
}

function extractCode(err: AnyError): string | undefined {
  if (!err || typeof err === "string" || err instanceof Error) return undefined;
  return err.code;
}

export function translateError(err: AnyError): string {
  const code = extractCode(err);
  if (code && PG_CODE_TRANSLATIONS[code]) return PG_CODE_TRANSLATIONS[code];

  const raw = extractMessage(err);
  if (AUTH_TRANSLATIONS[raw]) return AUTH_TRANSLATIONS[raw];

  // Match parcial pra mensagens que carregam contexto extra
  for (const [key, value] of Object.entries(AUTH_TRANSLATIONS)) {
    if (raw.includes(key)) return value;
  }

  return raw;
}
