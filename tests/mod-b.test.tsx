import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PhotosTest } from "@/components/mod-b/photos-test";
import { deletePhoto, getPhotoThumbUrl, listPhotos, savePhoto } from "@/lib/database";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/lib/store/authSlice";

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

const renderWithUser = () => {
  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        user: {
          _id: "user:demo",
          id: "user_demo",
          name: "Demo",
          email: "demo@example.com",
          password: "secret",
          role: "user",
          permissions: [],
          modulePermissions: { MOD_A: "NONE", MOD_B: "FULL", MOD_C: "NONE", MOD_D: "NONE" },
          isActive: true,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
        },
        token: "token",
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
    },
  });

  return render(
    <Provider store={store}>
      <PhotosTest />
    </Provider>,
  );
};

describe("PhotosTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carga y muestra las fotos existentes", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-1" } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-1");

    renderWithUser();

    expect(await screen.findByAltText("photo-1")).toBeInTheDocument();
    expect(mockListPhotos).toHaveBeenCalledWith({ owner: "user:demo", module: "MOD_B" });
    expect(mockGetPhotoThumbUrl).toHaveBeenCalledWith("photo-1");
  });

  it("guarda una foto capturada o subida y refresca la lista", async () => {
    mockListPhotos.mockResolvedValueOnce([]);
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-new" } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-new");
    mockSavePhoto.mockResolvedValue({ ok: true, _id: "photo-new" } as any);

    const { container } = renderWithUser();

    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(1));

    const fileInput = container.querySelectorAll("input[type='file']")[0] as HTMLInputElement;
    const file = new File(["contenido"], "nueva.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() =>
      expect(mockSavePhoto).toHaveBeenCalledWith(file, { owner: "user:demo", module: "MOD_B" }),
    );
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

    renderWithUser();

    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });

    fireEvent.click(deleteButton);

    await waitFor(() => expect(mockDeletePhoto).toHaveBeenCalledWith("photo-delete"));
    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByAltText("photo-delete")).toBeNull());
  });
});

