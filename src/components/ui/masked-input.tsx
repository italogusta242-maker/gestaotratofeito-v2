import * as React from "react";
import { Input } from "@/components/ui/input";
import { maskCep, maskCpfCnpj, maskPhone, maskCurrency, digitsToDecimal, decimalToDigits, onlyDigits } from "@/lib/masks";

type BaseProps = Omit<React.ComponentPropsWithoutRef<typeof Input>, "value" | "onChange" | "type">;

/** CEP: 00000-000 */
export function CepInput({ value, onChange, ...props }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={maskCep(value)}
      maxLength={9}
      onChange={(e) => onChange(maskCep(e.target.value))}
    />
  );
}

/** CPF ou CNPJ (adaptativo) */
export function CpfCnpjInput({ value, onChange, ...props }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="numeric"
      value={maskCpfCnpj(value)}
      maxLength={18}
      onChange={(e) => onChange(maskCpfCnpj(e.target.value))}
    />
  );
}

/** Telefone: (00) 00000-0000 */
export function PhoneInput({ value, onChange, ...props }: BaseProps & { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      {...props}
      inputMode="tel"
      value={maskPhone(value)}
      maxLength={15}
      onChange={(e) => onChange(maskPhone(e.target.value))}
    />
  );
}

/**
 * CurrencyInput (R$) — estilo calculadora.
 * `value`: número decimal (ex: 1234.56) ou string vazia.
 * `onChange(numero)`: recebe o valor decimal atualizado.
 */
export function CurrencyInput({
  value,
  onChange,
  ...props
}: BaseProps & { value: number | string | null | undefined; onChange: (v: number) => void }) {
  // Estado interno em string de dígitos (cents). Mantém sincronizado com prop.
  const [digits, setDigits] = React.useState(() => decimalToDigits(value));

  // Se o valor externo mudar (ex: reset ou defaultValues), atualiza.
  React.useEffect(() => {
    const incoming = decimalToDigits(value);
    // Só sincroniza se o valor decimal for realmente diferente do que o usuário digitou
    if (digitsToDecimal(incoming) !== digitsToDecimal(digits)) {
      setDigits(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      {...props}
      inputMode="decimal"
      value={digits ? maskCurrency(digits) : ""}
      placeholder={props.placeholder ?? "R$ 0,00"}
      onChange={(e) => {
        const raw = onlyDigits(e.target.value);
        setDigits(raw);
        onChange(digitsToDecimal(raw));
      }}
    />
  );
}
