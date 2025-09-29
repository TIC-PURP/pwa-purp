import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import type { ComponentProps } from "react";
import { PhotosTest } from "@/components/mod-b/photos-test";
import { deletePhoto, getPhotoThumbUrl, listPhotos, savePhoto } from "@/lib/database";
import authReducer, { type AuthState } from "@/lib/store/authSlice";
import type { User } from "@/lib/types";

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

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: "user_test",
  name: "Usuario Demo",
  email: "demo@example.com",
  password: "secret",
  role: "user",
  permissions: [],
  modulePermissions: {
    MOD_A: "NONE",
    MOD_B: "FULL",
    MOD_C: "NONE",
    MOD_D: "NONE",
  },
  isActive: true,
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ...overrides,
});

const baseUser = makeUser();

const baseAuthState: AuthState = {
  user: baseUser,
  token: "token",
  isAuthenticated: true,
  isLoading: false,
  error: null,
};

type PhotosTestComponentProps = ComponentProps<typeof PhotosTest>;

function renderWithStore(authOverride: Partial<AuthState> = {}, props: Partial<PhotosTestComponentProps> = {}) {
  const userOverride = authOverride.user;
  const user = userOverride === null
    ? null
    : { ...baseUser, ...(userOverride ?? {}) };

  const preloadedState: { auth: AuthState } = {
    auth: {
      ...baseAuthState,
      ...authOverride,
      user,
      isAuthenticated: Boolean(user),
      token: user ? baseAuthState.token : null,
    },
  };

  const store = configureStore({
    reducer: { auth: authReducer },
    preloadedState,
  });

  return render(
    <Provider store={store}>
      <PhotosTest {...props} />
    </Provider>,
  );
}

const expectOwnerCall = (ownerId: string) => {
  const calls = mockListPhotos.mock.calls;
  expect(calls[calls.length - 1]?.[0]).toEqual({ owner: ownerId });
};

describe("PhotosTest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });


  it("carga y muestra las fotos existentes del usuario", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-1", createdAt: "2024-01-05T10:00:00.000Z", ownerName: baseUser.name } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-1");

    renderWithStore();

    expect(await screen.findByAltText("photo-1")).toBeInTheDocument();
    expect(mockListPhotos).toHaveBeenCalledTimes(1);
    expectOwnerCall(baseUser.id);
    expect(mockGetPhotoThumbUrl).toHaveBeenCalledWith("photo-1");
  });

  it("guarda una nueva foto y refresca la lista del usuario", async () => {
    mockListPhotos.mockResolvedValueOnce([]);
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-new", createdAt: "2024-01-05T12:00:00.000Z", ownerName: baseUser.name } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-new");
    mockSavePhoto.mockResolvedValue({ ok: true, _id: "photo-new" } as any);

    const { container } = renderWithStore();

    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(1));
    expectOwnerCall(baseUser.id);

    const fileInput = container.querySelectorAll("input[type='file']")[0] as HTMLInputElement;
    const file = new File(["contenido"], "nueva.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockSavePhoto).not.toHaveBeenCalled();

    const saveButton = await screen.findByRole("button", { name: /guardar 1 foto/i });
    expect(saveButton).toBeEnabled();

    fireEvent.click(saveButton);

    await waitFor(() => expect(mockSavePhoto).toHaveBeenCalledWith(file, {
      owner: baseUser.id,
      ownerName: baseUser.name,
      ownerEmail: baseUser.email,
    }));
    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(2));
    expectOwnerCall(baseUser.id);
    await waitFor(() => expect(screen.queryByRole("button", { name: /guardar 1 foto/i })).toBeNull());
    expect(await screen.findByAltText("photo-new")).toBeInTheDocument();
  });

  it("elimina una foto y actualiza la grilla del usuario", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-delete", createdAt: "2024-01-05T08:00:00.000Z", ownerName: baseUser.name } as any,
    ]);
    mockListPhotos.mockResolvedValueOnce([]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-delete");
    mockDeletePhoto.mockResolvedValue({ ok: true } as any);

    renderWithStore();

    const deleteButton = await screen.findByRole("button", { name: /eliminar/i });

    fireEvent.click(deleteButton);

    await waitFor(() => expect(mockDeletePhoto).toHaveBeenCalledWith("photo-delete"));
    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(2));
    expectOwnerCall(baseUser.id);
    await waitFor(() => expect(screen.queryByAltText("photo-delete")).toBeNull());
  });
  it("permite descartar fotos pendientes antes de guardar", async () => {
    mockListPhotos.mockResolvedValueOnce([]);

    const { container } = renderWithStore();

    await waitFor(() => expect(mockListPhotos).toHaveBeenCalledTimes(1));
    const fileInput = container.querySelectorAll("input[type='file']")[0] as HTMLInputElement;
    const file = new File(["contenido"], "pendiente.jpg", { type: "image/jpeg" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    const discardButton = await screen.findByRole("button", { name: /descartar pendientes/i });
    expect(discardButton).toBeEnabled();
    expect(await screen.findByText(/vista previa no disponible/i)).toBeInTheDocument();

    fireEvent.click(discardButton);

    await waitFor(() => expect(screen.queryByText(/vista previa no disponible/i)).toBeNull());
    expect(mockSavePhoto).not.toHaveBeenCalled();
  });

  it("en modo lectura solo permite visualizar las fotos", async () => {
    mockListPhotos.mockResolvedValueOnce([
      { _id: "photo-read", createdAt: "2024-01-05T09:00:00.000Z", ownerName: baseUser.name } as any,
    ]);
    mockGetPhotoThumbUrl.mockResolvedValueOnce("blob:photo-read");

    const { container } = renderWithStore({}, { readOnly: true });

    expect(await screen.findByAltText("photo-read")).toBeInTheDocument();
    expectOwnerCall(baseUser.id);

    const tomarFoto = screen.getByRole("button", { name: /tomar foto/i });
    const subir = screen.getByRole("button", { name: /subir desde galeria/i });
    expect(tomarFoto).toBeDisabled();
    expect(subir).toBeDisabled();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();

    const fileInput = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(['contenido'], 'read-only.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(mockSavePhoto).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /guardar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /eliminar/i })).toBeNull();
    expect(mockDeletePhoto).not.toHaveBeenCalled();
  });
});
