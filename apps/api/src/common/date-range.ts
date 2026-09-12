import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

function dateParts(value: string): [number, number, number] {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new BadRequestException(`Data inválida: ${value}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Constrói o início do dia (00:00:00 local) a partir de uma string
 * "YYYY-MM-DD". `new Date("YYYY-MM-DD")` é sempre interpretado como
 * meia-noite UTC, o que desloca a data em um dia em fusos atrás de UTC
 * (ex.: America/Sao_Paulo) — por isso os componentes são extraídos da
 * string e usados diretamente no construtor local do `Date`.
 */
export function startOfDayLocal(value: string): Date {
  const [year, month, day] = dateParts(value);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Fim do dia (23:59:59.999 local) — ver `startOfDayLocal`. */
export function endOfDayLocal(value: string): Date {
  const [year, month, day] = dateParts(value);
  return new Date(year, month - 1, day, 23, 59, 59, 999);
}
