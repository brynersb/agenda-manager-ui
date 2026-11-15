import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronDown,
  ClipboardList,
  KeyRound,
  LogOut,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { AvatarInitial } from '@/components/ui/avatar-initial';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  type FormPresentation,
  type UiTheme,
  useAppearance,
} from '@/hooks/use-preferences';
import { ROLE_LABEL } from '@/lib/labels';
import type { Role } from '@/types/auth';

const UI_THEME_OPTIONS: { value: UiTheme; label: string }[] = [
  { value: 'soft', label: 'Suave' },
  { value: 'classic', label: 'Clássica' },
];

const FORM_PRESENTATION_OPTIONS: { value: FormPresentation; label: string }[] =
  [
    { value: 'modal', label: 'Modal' },
    { value: 'drawer', label: 'Painel lateral' },
  ];

const RADIO_ITEM_CLASS =
  'flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover';

const ITEM_CLASS =
  'flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover';

interface UserMenuProps {
  name: string;
  userRole: Role | null;
  /** Mostra "Pautas" (`content-brief:read`). */
  canReadContentBriefs?: boolean;
  /** Mostra "Usuários" (`user:read`). */
  canReadUsers?: boolean;
  /** Encerra a sessão; o menu espera a promessa para mostrar o andamento. */
  onSignOut: () => void | Promise<void>;
}

/**
 * Menu da pessoa logada: nome, papel, atalhos de navegação (Pautas, Usuários,
 * Alterar senha), preferências de aparência (tema e forma dos formulários) e
 * "Sair" com confirmação.
 *
 * "Usuários" só aparece para quem tem `user:read`; quem decide é o chamador,
 * com `hasPermission`. As escolhas de aparência valem na hora e ficam salvas
 * neste navegador; o menu continua aberto depois de escolher, para a pessoa ver
 * o efeito.
 *
 * @param props.name Nome exibido.
 * @param props.userRole Papel da pessoa, mostrado como rótulo.
 * @param props.canReadContentBriefs Oferece o atalho para as pautas.
 * @param props.canReadUsers Oferece o atalho para a administração de usuários.
 * @param props.onSignOut Executa o logout depois da confirmação.
 * @returns O gatilho do menu e o modal de confirmação.
 */
export function UserMenu({
  name,
  userRole,
  canReadContentBriefs = false,
  canReadUsers = false,
  onSignOut,
}: UserMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const roleLabel = userRole ? ROLE_LABEL[userRole] : null;
  const { appearance, setAppearance } = useAppearance();
  const navigate = useNavigate();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Menu do usuário"
            className="inline-flex min-h-10 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-2.5 text-ink text-sm hover:bg-hover"
          >
            <AvatarInitial name={name} />
            <span className="truncate font-medium">{name}</span>
            <ChevronDown className="size-4 flex-none" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-30 min-w-56 rounded-xl border border-line bg-surface p-1.5 text-ink shadow-float"
          >
            <div className="px-2.5 py-2">
              <p className="m-0 font-semibold text-sm">{name}</p>
              {roleLabel && (
                <p className="m-0 text-muted text-xs">{roleLabel}</p>
              )}
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            {canReadContentBriefs && (
              <DropdownMenu.Item
                onSelect={() => navigate('/content-briefs')}
                className={ITEM_CLASS}
              >
                <ClipboardList className="size-4" aria-hidden="true" />
                Pautas
              </DropdownMenu.Item>
            )}
            {canReadUsers && (
              <DropdownMenu.Item
                onSelect={() => navigate('/users')}
                className={ITEM_CLASS}
              >
                <Users className="size-4" aria-hidden="true" />
                Usuários
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              onSelect={() => navigate('/change-password')}
              className={ITEM_CLASS}
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Alterar senha
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Group>
              <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-medium text-muted text-xs">
                Aparência
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                aria-label="Aparência"
                value={appearance.uiTheme}
                onValueChange={(value) =>
                  setAppearance({ uiTheme: value as UiTheme })
                }
              >
                {UI_THEME_OPTIONS.map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    onSelect={(event) => event.preventDefault()}
                    className={RADIO_ITEM_CLASS}
                  >
                    {option.label}
                    <DropdownMenu.ItemIndicator>
                      <Check
                        className="size-4 text-accent"
                        aria-hidden="true"
                      />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Group>
              <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 font-medium text-muted text-xs">
                Formulários
              </DropdownMenu.Label>
              <DropdownMenu.RadioGroup
                aria-label="Formulários"
                value={appearance.formPresentation}
                onValueChange={(value) =>
                  setAppearance({ formPresentation: value as FormPresentation })
                }
              >
                {FORM_PRESENTATION_OPTIONS.map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    onSelect={(event) => event.preventDefault()}
                    className={RADIO_ITEM_CLASS}
                  >
                    {option.label}
                    <DropdownMenu.ItemIndicator>
                      <Check
                        className="size-4 text-accent"
                        aria-hidden="true"
                      />
                    </DropdownMenu.ItemIndicator>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Group>
            <DropdownMenu.Separator className="my-1 h-px bg-line" />
            <DropdownMenu.Item
              onSelect={() => setConfirming(true)}
              className={ITEM_CLASS}
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Modal
        open={confirming}
        onOpenChange={(open) => {
          if (!signingOut) setConfirming(open);
        }}
        title="Sair da pauta?"
        description="Você precisará entrar de novo para ver ou editar as pautas."
        footer={
          <>
            <Button
              variant="ghost"
              disabled={signingOut}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
            <Button loading={signingOut} onClick={() => void handleSignOut()}>
              Sair
            </Button>
          </>
        }
      />
    </>
  );
}
