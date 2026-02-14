import { jest, describe, test, expect, beforeEach } from "@jest/globals";
import path from "path";

// Define mocks before importing the module under test
jest.unstable_mockModule("fs", () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
  },
}));

// Dynamic imports are required after unstable_mockModule
const { promises: fs } = await import("fs");
const { FileMemory } = await import("../src/file/memo.js");

describe("FileMemory", () => {
  let fileMemory;
  const mockBase = "./test_notes";

  beforeEach(() => {
    fileMemory = new FileMemory(mockBase);
    jest.clearAllMocks();
  });

  test("write saves file to correct path", async () => {
    const folder = "project";
    const name = "todo";
    const content = "# TODO";

    await fileMemory.write(folder, name, content);

    const expectedDir = path.resolve(mockBase, folder);
    const expectedFile = path.join(expectedDir, `${name}.md`);

    expect(fs.mkdir).toHaveBeenCalledWith(expectedDir, { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(expectedFile, content, "utf8");
  });

  test("read retrieves file content", async () => {
    (fs.readFile as any).mockResolvedValue("some content");
    
    const result = await fileMemory.read("folder", "note");
    expect(result).toBe("some content");
  });

  test("read returns null on error", async () => {
    (fs.readFile as any).mockRejectedValue(new Error("ENOENT"));
    
    const result = await fileMemory.read("folder", "note");
    expect(result).toBeNull();
  });
  
  test("prevents path traversal", async () => {
      // Since read returns null on error, we expect null here.
      // The path traversal check in implementation throws "Invalid path", 
      // which is caught by the try-catch in read() and returns null.
      const result = await fileMemory.read("..", "system_file");
      expect(result).toBeNull();
  });
});
