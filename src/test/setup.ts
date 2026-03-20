import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
    onAuthStateChanged: vi.fn((cb) => {
      cb(null);
      return vi.fn(); // Return an unsubscribe function
    }),
  },
  db: {},
  signIn: vi.fn(() => Promise.resolve()),
  handleFirestoreError: vi.fn(),
  FirestoreOperationType: {
    LIST: 'list',
    CREATE: 'create',
  },
  logAppEvent: vi.fn(),
}));

// Mock Gemini Service
vi.mock('../services/geminiService', () => ({
  processMedicalInput: vi.fn(() => Promise.resolve({
    situation: 'Test Situation',
    patientSummary: { age: '30', conditions: [], medications: [] },
    actions: ['Action 1'],
    warnings: [],
    language: 'English',
  })),
}));

// Mock Speech Synthesis
Object.defineProperty(window, 'speechSynthesis', {
  value: {
    speak: vi.fn(),
  },
});

// Mock Speech Recognition
(window as any).webkitSpeechRecognition = vi.fn().mockImplementation(function() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    onresult: null,
    onerror: null,
    continuous: false,
    interimResults: false,
  };
});
