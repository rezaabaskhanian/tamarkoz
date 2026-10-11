/* eslint-env jest */
// Native modules are not available under Jest; unit tests only cover pure logic.
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
