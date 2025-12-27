import {useState, useEffect, useRef} from 'react'


const useMediaStream = () => {
    const [state, setState] = useState(null)
    const [error, setError] = useState(null)
    const isStreamSet = useRef(false)

    useEffect(() => {
        if (isStreamSet.current) return;
        
        // Проверяем, что мы в браузере и navigator.mediaDevices доступен
        if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setError("Медиа устройства не поддерживаются в этом браузере или требуется HTTPS")
            return;
        }
        
        isStreamSet.current = true;
        (async function initStream() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true
                })
                console.log("setting your stream")
                setState(stream)
            } catch (e) {
                console.error("Error in media navigator", e)
                setError(e.message || "Failed to access camera/microphone")
                
                // Пытаемся получить только аудио, если видео не доступно
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: false
                    })
                    console.log("setting audio only stream")
                    setState(audioStream)
                } catch (audioError) {
                    console.error("Error getting audio stream", audioError)
                    setError(audioError.message || "Не удалось получить доступ к микрофону")
                }
            }
        })()

        return () => {
            if (state) {
                state.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    return {
        stream: state,
        error
    }
}

export default useMediaStream