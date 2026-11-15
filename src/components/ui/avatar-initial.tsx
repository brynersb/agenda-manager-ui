import { initial } from '@/lib/text';

/**
 * Círculo com a inicial do responsável.
 *
 * É decorativo (`aria-hidden`): o nome completo aparece ao lado, em texto.
 *
 * @param props.name Nome de quem será representado.
 * @returns O círculo com a inicial.
 */
export function AvatarInitial({ name }: { name: string }) {
  return (
    <i
      aria-hidden="true"
      className="grid size-5 flex-none place-items-center rounded-full bg-accent-tint font-bold font-display text-[11px] text-accent not-italic leading-none"
    >
      {initial(name)}
    </i>
  );
}
