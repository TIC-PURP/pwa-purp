import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotosTest } from "@/app/mod-b/page";
import { deletePhoto, getPhotoThumbUrl, listPhotos, savePhoto } from "@/lib/database";

jest.mock("@/lib/database", () => ({
  listPhotos: jest.fn(),
  savePhoto: jest.fn(),
  getPhotoThumbUrl: jest.fn(),
  deletePhoto: jest.fn(),
}));

const mockListPhotos = listPhotos as jest.MockedFunction<typeof listPhotos>;
const mockSavePhoto = savePhoto as jest.MockedFunction<typeof savePhoto>;
const mockGetPhotoThumbUrl = getPhotoThumbUrl as jest.MockedFunction<typeof getPhotoThumbUrl>;
const mockDeletePhoto = deletePhoto as jest.MockedFunction<typeof deletePhoto>;

describe("PhotosTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carga y muestra las fotos existentes", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-1" } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-1");

    render(<PhotosTest />);

    expect(await screen.findByAltText("photo-1")).toBeInTheDocument();
    expect(mockListPhotos).toHaveBeenCalledTimes(1);
    expect(mockGetPhotoThumbUrl).toHaveBeenCalledWith("photo-1");
  });

  it("guarda una foto capturada o subida y refresca la lista", async () => {
    mockListPhotos.mockResolvedValueOnce([]);
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-new" } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-new");
    mockSavePhoto.mockResolvedValue({ ok: true, _id: "photo-new" } as any);

    const { container } = render(<PhotosTest />);

    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(1));

    const fileInput = container.querySelectorAll("input[type='file']")[0] as HTMLInputElement;
    const file = new File(["contenido"], "nueva.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => expect(mockSavePhoto).toHaveBeenCalledWith(file, {}));
    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(2));
    expect(await screen.findByAltText("photo-new")).toBeInTheDocument();
  });

  it("elimina una foto y actualiza la grilla", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-delete" } as any,
    ]);
    mockListPhotos.mockResolvedValueOnce([]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-delete");
    mockDeletePhoto.mockResolvedValue({ ok: true } as any);

    render(<PhotosTest />);

    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });

    fireEvent.click(deleteButton);

    await waitFor(() => expect(mockDeletePhoto).toHaveBeenCalledWith("photo-delete"));
    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByAltText("photo-delete")).toBeNull());
  });
});
