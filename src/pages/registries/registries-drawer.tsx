import { useAuthContext } from '@/auth/use-auth';
import { FormSurface } from '@/components/ui/form-surface';
import { RegistrySection } from './registry-section';

interface RegistriesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Janela (modal ou painel lateral, conforme a preferência da pessoa)
 * "Empreendimentos e responsáveis"; o nome do arquivo segue o ADR-015.
 *
 * Quem abre é a tela de pautas, que só oferece o botão com `registry:write`.
 * Se o painel chegar aberto sem essa permissão (estado antigo), mostra as
 * listas só para leitura, sem nenhuma ação de escrita.
 *
 * @param props.open Se o painel está aberto.
 * @param props.onOpenChange Notifica abertura e fechamento.
 * @returns O painel.
 */
export function RegistriesDrawer({
  open,
  onOpenChange,
}: RegistriesDrawerProps) {
  const { hasPermission } = useAuthContext();
  const canWrite = hasPermission('registry:write');

  return (
    <FormSurface
      size="lg"
      open={open}
      onOpenChange={onOpenChange}
      title="Empreendimentos e responsáveis"
    >
      <p className="m-0 mb-2 text-muted text-sm">
        Os nomes cadastrados aparecem para escolher em cada pauta. Arquivar tira
        o nome da lista, mas as pautas que já o usam continuam com ele.
      </p>
      {!canWrite && (
        <p className="m-0 mb-2 text-muted text-sm">
          Você pode consultar os cadastros, mas não alterá-los.
        </p>
      )}
      <div className="divide-y divide-line">
        <RegistrySection
          kind="estate-developments"
          title="Empreendimentos"
          newPlaceholder="Nome do empreendimento"
          canWrite={canWrite}
        />
        <RegistrySection
          kind="owners"
          title="Responsáveis"
          newPlaceholder="Nome da pessoa"
          canWrite={canWrite}
        />
      </div>
    </FormSurface>
  );
}
