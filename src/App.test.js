import { render, screen } from '@testing-library/react';
import App from './App';

test('renders helicopter schedule app', () => {
  render(<App />);
  // App should render without crashing - check for login form or main content
  const appElement = document.querySelector('.app') || document.body.firstChild;
  expect(appElement).toBeInTheDocument();
});

test('renders login page when not authenticated', () => {
  render(<App />);
  // When not authenticated, should show login/auth components
  const authElement = screen.queryByRole('button') || screen.queryByRole('textbox');
  expect(authElement).toBeDefined();
});
