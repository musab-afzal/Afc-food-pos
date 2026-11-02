import { usePos } from '../context/PosContext.jsx';

export default function PosNotice() {
    const { state, patch } = usePos();
    if (!state.notice) return null;
    const tone = state.noticeTone === 'error'
        ? 'bg-coral text-white'
        : state.noticeTone === 'success'
            ? 'bg-herb text-white'
            : 'bg-lime text-ink';

    return (
        <button
            type="button"
            onClick={() => patch({ notice: '' })}
            className={`fixed left-3 right-3 top-16 z-[60] rounded-xl px-4 py-2.5 text-left text-sm font-medium shadow-lg xl:left-auto xl:right-4 xl:max-w-md ${tone}`}
        >
            {state.notice}
        </button>
    );
}
