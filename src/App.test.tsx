import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from './App';
import React from 'react';

describe('App Component', () => {
  it('renders the header with the app name', () => {
    render(<App />);
    expect(screen.getByText(/MediBridge/i)).toBeInTheDocument();
  });

  it('renders the input textarea', () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Type symptoms or medical history here.../i)).toBeInTheDocument();
  });

  it('toggles recording state when Mic button is clicked', () => {
    render(<App />);
    const micButton = screen.getByLabelText(/Start recording/i);
    fireEvent.click(micButton);
    expect(screen.getByLabelText(/Stop recording/i)).toBeInTheDocument();
  });
});
