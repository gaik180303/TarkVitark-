import '@testing-library/jest-dom';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement these; components/libs touch them.
vi.stubGlobal('scrollTo', () => {});

afterEach(() => {
  cleanup();
});
