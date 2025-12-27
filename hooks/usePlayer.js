import {useState} from 'react'
import { useSocket } from '@/context/socket'
import { useRouter } from 'next/router'

const usePlayer = (myId, roomId, peer) => {
    const socket = useSocket()
    const [players, setPlayers] = useState({})
    const router = useRouter()

    const playerHighlighted = players[myId]
    
    const nonHighlightedPlayers = Object.keys(players).reduce((acc, playerId) => {
        if (playerId !== myId) {
            acc[playerId] = players[playerId]
        }
        return acc
    }, {})

    const leaveRoom = () => {
        if (myId) {
            socket?.emit('user-leave', myId, roomId)
        }
        console.log("leaving room", roomId)
        peer?.disconnect();
        router.push('/')
    }

    const toggleAudio = () => {
        if (!myId || !players[myId]) {
            console.warn("Cannot toggle audio: player not initialized")
            return
        }
        console.log("I toggled my audio")
        setPlayers((prev) => {
            if (!prev[myId]) return prev
            return {
                ...prev,
                [myId]: {
                    ...prev[myId],
                    muted: !prev[myId].muted
                }
            }
        })
        socket.emit('user-toggle-audio', myId, roomId)
    }

    const toggleVideo = () => {
        if (!myId || !players[myId]) {
            console.warn("Cannot toggle video: player not initialized")
            return
        }
        console.log("I toggled my video")
        setPlayers((prev) => {
            if (!prev[myId]) return prev
            return {
                ...prev,
                [myId]: {
                    ...prev[myId],
                    playing: !prev[myId].playing
                }
            }
        })
        socket.emit('user-toggle-video', myId, roomId)
    }

    return {players, setPlayers, playerHighlighted, nonHighlightedPlayers, toggleAudio, toggleVideo, leaveRoom}
}

export default usePlayer;