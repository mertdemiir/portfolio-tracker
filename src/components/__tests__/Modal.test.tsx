import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../Modal';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Modal', () => {
  it('renders with role=dialog, aria-modal, and aria-labelledby', () => {
    render(
      <Modal title="Hello" onClose={() => {}}>
        <p>Body</p>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Hello');
  });

  it('renders close button with aria-label by default', () => {
    render(<Modal title="T" onClose={() => {}}>x</Modal>);
    expect(screen.getByRole('button', { name: /close dialog/i })).toBeInTheDocument();
  });

  it('hides close button when hideCloseButton=true', () => {
    render(<Modal title="T" onClose={() => {}} hideCloseButton>x</Modal>);
    expect(screen.queryByRole('button', { name: /close dialog/i })).not.toBeInTheDocument();
  });

  it('calls onClose when ESC is pressed', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on ESC when disableDismiss=true', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose} disableDismiss>x</Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}>x</Modal>);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not close on backdrop click when disableDismiss=true', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose} disableDismiss>x</Modal>);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(backdrop!);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus to the dialog container on mount (regression: #39)', () => {
    render(
      <Modal title="T" onClose={() => {}}>
        <input data-testid="first-input" />
      </Modal>
    );
    // We focus the dialog container (tabindex=-1), not any child, so
    // screen readers announce the title and Tab lands on the first real
    // control rather than the close X.
    const dialog = screen.getByRole('dialog').querySelector('[tabindex="-1"]');
    expect(document.activeElement).toBe(dialog);
  });

  it('applies the correct max-width class per size', () => {
    const { rerender } = render(<Modal title="T" onClose={() => {}} size="md">x</Modal>);
    let card = document.querySelector('.max-w-md');
    expect(card).toBeTruthy();

    rerender(<Modal title="T" onClose={() => {}} size="2xl">x</Modal>);
    card = document.querySelector('.max-w-2xl');
    expect(card).toBeTruthy();
  });

  it('restores focus to the previously active element on unmount', () => {
    const opener = document.createElement('button');
    opener.textContent = 'open';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { unmount } = render(<Modal title="T" onClose={() => {}}>x</Modal>);
    // Focus moved into the modal
    expect(document.activeElement).not.toBe(opener);

    unmount();
    // Focus returned to the opener
    expect(document.activeElement).toBe(opener);
  });
});
