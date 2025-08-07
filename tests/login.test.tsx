import { render, screen, fireEvent } from '@testing-library/react';
import LoginForm from '@/components/LoginForm';

describe('LoginForm', () => {
  it('should render email and password inputs', () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should show error on empty submit', async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/required/i)).toBeInTheDocument();
  });
});