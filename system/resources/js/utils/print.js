/**
 * Print HTML without window.open (blocked after await / by popup blockers).
 * Uses a hidden iframe so POS "Complete & print" works after the sale API returns.
 */
export function printHtml(html, { autoPrint = true, title = 'Print' } = {}) {
    const previous = document.getElementById('respos-print-frame');
    if (previous) previous.remove();

    const frame = document.createElement('iframe');
    frame.id = 'respos-print-frame';
    frame.title = title;
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
        position: 'fixed',
        right: '0',
        bottom: '0',
        width: '0',
        height: '0',
        border: '0',
        opacity: '0',
        pointerEvents: 'none',
    });
    document.body.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) {
        frame.remove();
        throw new Error('Unable to prepare the print view.');
    }

    doc.open();
    doc.write(html);
    doc.close();

    const runPrint = () => {
        try {
            frame.contentWindow?.focus();
            if (autoPrint) frame.contentWindow?.print();
        } catch (error) {
            frame.remove();
            throw error;
        }
    };

    // Give the iframe a tick to layout before invoking the print dialog.
    setTimeout(runPrint, 300);

    const cleanup = () => {
        setTimeout(() => frame.remove(), 1000);
    };
    if (frame.contentWindow) {
        frame.contentWindow.onafterprint = cleanup;
    }
    setTimeout(cleanup, 60_000);

    return frame;
}

export const escapeHtml = (value) => String(value ?? '').replace(
    /[&<>'"]/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
);
