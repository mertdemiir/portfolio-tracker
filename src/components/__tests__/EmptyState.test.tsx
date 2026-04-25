import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('EmptyState (Mercury chrome)', () => {
  it('renders the heading and call-to-action', () => {
    render(<EmptyState onAdd={() => {}} />);
    expect(screen.getByRole('heading', { name: /no holdings yet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add your first asset/i })).toBeInTheDocument();
  });

  it('calls onAdd when the CTA is clicked', () => {
    const onAdd = vi.fn();
    render(<EmptyState onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /add your first asset/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
