import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api-error';
import { CreatableCombobox, type CreatableOption } from './creatable-combobox';

const OPCOES: CreatableOption[] = [
  { id: 'e1', name: 'Residencial Ipê', active: true },
  { id: 'e2', name: 'Jardim das Águas', active: true },
  { id: 'e3', name: 'Antigo Mirante', active: false },
];

interface HarnessProps {
  initialValue?: string | null;
  canCreate?: boolean;
  onCreate?: (name: string) => Promise<{ id: string; name: string }>;
  onChange?: (id: string | null) => void;
}

function Harness({
  initialValue = null,
  canCreate = true,
  onCreate = vi.fn().mockResolvedValue({ id: 'novo', name: 'Novo' }),
  onChange,
}: HarnessProps) {
  const [valor, setValor] = useState<string | null>(initialValue);
  return (
    <CreatableCombobox
      label="Empreendimento"
      options={OPCOES}
      value={valor}
      onChange={(id) => {
        setValor(id);
        onChange?.(id);
      }}
      noneLabel="Nenhum"
      canCreate={canCreate}
      onCreate={onCreate}
      newPlaceholder="Nome do empreendimento"
    />
  );
}

describe('ComboboxCriavel', () => {
  it('mostra só os ativos e filtra ignorando acento e caixa', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox', { name: 'Empreendimento' }));
    expect(
      screen.getByRole('option', { name: 'Residencial Ipê' }),
    ).toBeVisible();
    expect(screen.queryByRole('option', { name: /Antigo Mirante/ })).toBeNull();

    await user.type(screen.getByRole('combobox'), 'AGUAS');

    expect(
      screen.getByRole('option', { name: 'Jardim das Águas' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('option', { name: 'Residencial Ipê' }),
    ).toBeNull();
  });

  it('seleciona uma opção e mostra o nome no campo', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Jardim das Águas' }));

    expect(onChange).toHaveBeenCalledWith('e2');
    expect(screen.getByRole('combobox')).toHaveValue('Jardim das Águas');
  });

  it('a opção "Nenhum" limpa o valor', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="e1" onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Nenhum' }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('exibe o valor arquivado como "Nome (arquivado)" e não o oferece sem ser o valor atual', async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="e3" />);

    const campo = screen.getByRole('combobox');
    expect(campo).toHaveValue('Antigo Mirante (arquivado)');

    await user.click(campo);
    expect(
      screen.getByRole('option', { name: 'Antigo Mirante (arquivado)' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('navega por teclado: setas e Enter escolhem, Esc fecha', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenCalledWith('e2');

    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('não oferece "+ Adicionar novo…" sem permissão de criar', async () => {
    const user = userEvent.setup();
    render(<Harness canCreate={false} />);

    await user.click(screen.getByRole('combobox'));

    expect(screen.queryByRole('option', { name: /Adicionar novo/ })).toBeNull();
  });

  it('cria um nome novo com Enter, seleciona o criado e volta ao seletor', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: 'e9', name: 'Vila Nova' });
    const onChange = vi.fn();
    render(<Harness onCreate={onCreate} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '+ Adicionar novo…' }));
    await user.type(
      screen.getByPlaceholderText('Nome do empreendimento'),
      '  Vila   Nova {Enter}',
    );

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('e9'));
    expect(onCreate).toHaveBeenCalledWith('Vila Nova');
    expect(screen.getByRole('combobox')).toBeVisible();
  });

  it('seleciona o existente em vez de duplicar quando o nome já está entre os ativos', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onChange = vi.fn();
    render(<Harness onCreate={onCreate} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '+ Adicionar novo…' }));
    await user.type(
      screen.getByPlaceholderText('Nome do empreendimento'),
      'residencial ipe{Enter}',
    );

    expect(onChange).toHaveBeenCalledWith('e1');
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('mostra o erro de nome duplicado da API abaixo do campo e mantém a digitação', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'ESTATE_DEVELOPMENT_NAME_DUPLICATED',
      }),
    );
    const onChange = vi.fn();
    render(<Harness onCreate={onCreate} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '+ Adicionar novo…' }));
    const campo = screen.getByPlaceholderText('Nome do empreendimento');
    await user.type(campo, 'Antigo Mirante{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe um empreendimento com este nome. Se ele estiver arquivado, reative-o.',
    );
    expect(campo).toHaveValue('Antigo Mirante');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Esc cancela a criação e devolve o seletor', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: '+ Adicionar novo…' }));
    await user.keyboard('{Escape}');

    expect(screen.getByRole('combobox')).toBeVisible();
    expect(screen.queryByPlaceholderText('Nome do empreendimento')).toBeNull();
  });
});
