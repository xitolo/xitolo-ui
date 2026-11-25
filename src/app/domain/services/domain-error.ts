/** Violação de uma regra de negócio. A mensagem é apresentada ao utilizador. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DomainError';
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof DomainError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro inesperado.';
}
