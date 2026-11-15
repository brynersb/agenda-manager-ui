import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronDown, LogOut } from 'lucide-react';
import { useState } from 'react';

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

interface UserMenuProps {
  name: string;
  roles: readonly Role[];
  onSignOut: () => void;
}

/**
 * Menu da pessoa logada: nome, papel, preferências de aparência (tema e forma
 * dos formulários) e "Sair" com confirmação.
 *
 * As escolhas de aparência valem na hora e ficam salvas neste navegador; o menu
 * continua aberto depois de escolher, para a pessoa ver o efeito.
 *
 * @param props.name Nome exibido.
 * @param props.roles Papéis da pessoa; o rótulo mostra o primeiro.
 * @param props.onSignOut Executa o logout depois da confirmação.
 * @returns O gatilho do menu e o modal de confirmação.
 */
export function UserMenu({ name, roles, onSignOut }: UserMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const role = roles[0] ? ROLE_LABEL[roles[0]] : null;
  const { appearance, setAppearance } = useAppearance();

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
              {role && <p className="m-0 text-muted text-xs">{role}</p>}
            </div>
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
              className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-hover"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Modal
        open={confirming}
        onOpenChange={setConfirming}
        title="Sair da pauta?"
        description="Você precisará entrar de novo para ver ou editar as pautas."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button onClick={onSignOut}>Sair</Button>
          </>
        }
      />
    </>
  );
}
