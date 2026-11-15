/** Recursos de cadastro; os dois têm o mesmo contrato (plan técnico §5.2). */
export type RegistryKind = 'estate-developments' | 'owners';

/** Empreendimento ou responsável, como devolvido por `GET /<kind>`. */
export interface Registry {
  id: string;
  name: string;
  /** Só os responsáveis têm e-mail. */
  email?: string | null;
  active: boolean;
  /** Controle de concorrência: vai de volta no `PATCH`. */
  version: number;
  /** Pautas não concluídas que usam o cadastro (aviso antes de arquivar). */
  openContentBriefs: number;
}
