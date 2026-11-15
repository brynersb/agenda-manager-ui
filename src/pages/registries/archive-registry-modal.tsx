import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field-error';
import { Modal } from '@/components/ui/modal';
import { useArchiveRegistry } from '@/hooks/use-registries';
import { getApiErrorMessage } from '@/lib/api-error';
import type { Registry, RegistryKind } from '@/types/registry';

interface ArchiveRegistryModalProps {
  kind: RegistryKind;
  /** Cadastro a arquivar; `null` mantém o modal fechado. */
  registry: Registry | null;
  onClose: () => void;
}

/**
 * Texto de apoio da confirmação de arquivar.
 *
 * Com pautas abertas o aviso diz quantas são, porque arquivar não as altera:
 * elas continuam exibindo o nome. Sem pautas, explica só o efeito na lista.
 *
 * @param openContentBriefs Pautas não concluídas que usam o cadastro.
 * @returns A frase em pt-BR, com singular e plural.
 */
export function archiveDescription(openContentBriefs: number): string {
  if (openContentBriefs === 1) {
    return '1 pauta aberta usa este nome. Ela continua mostrando o nome depois de arquivar.';
  }
  if (openContentBriefs > 1) {
    return `${openContentBriefs} pautas abertas usam este nome. Elas continuam mostrando o nome depois de arquivar.`;
  }
  return 'O nome sai da lista de escolha. Você pode reativá-lo quando quiser.';
}

/**
 * Modal de confirmação para arquivar um empreendimento ou responsável.
 *
 * O erro da API aparece dentro do modal, que fica aberto para a pessoa tentar
 * de novo ou cancelar.
 *
 * @param props.kind Recurso do cadastro.
 * @param props.registry Cadastro a arquivar, ou `null` (fechado).
 * @param props.onClose Chamado ao cancelar ou depois de arquivar.
 * @returns O modal.
 */
export function ArchiveRegistryModal({
  kind,
  registry,
  onClose,
}: ArchiveRegistryModalProps) {
  const archive = useArchiveRegistry(kind);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!registry) return;
    try {
      await archive.mutateAsync(registry.id);
      close();
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  }

  return (
    <Modal
      open={registry !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={registry ? `Arquivar "${registry.name}"?` : 'Arquivar'}
      description={
        registry ? archiveDescription(registry.openContentBriefs) : ''
      }
      footer={
        <>
          <Button
            variant="secondary"
            disabled={archive.isPending}
            onClick={close}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={archive.isPending}
            onClick={() => void confirm()}
          >
            Arquivar
          </Button>
        </>
      }
    >
      {error && (
        <div role="alert">
          <FieldError>{error}</FieldError>
        </div>
      )}
    </Modal>
  );
}
