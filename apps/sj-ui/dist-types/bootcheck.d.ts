type KiwiBootApi = {
    mounted: boolean;
    renderMessage: (title: string, detail: string) => void;
    renderError: (detail: string) => void;
    hide: () => void;
};
declare global {
    interface Window {
        __KIWI_BOOT_API__?: KiwiBootApi;
    }
}
export {};
