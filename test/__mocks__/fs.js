// mocks fs because it's not implicit in jest
const fs = jest.createMockFromModule("fs");

fs.existsSync = jest.fn(() => true);

fs.createReadStream = jest.fn(() => {
  return {
    pipe: jest.fn(),
    on: jest.fn()
  };
});

export default fs;
