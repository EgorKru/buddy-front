import { useSocket } from "@/context/socket"
import { useRouter } from "next/router"

const { useState, useEffect, useRef } = require("react")

const usePeer = () => {
    const socket = useSocket()
    const roomId = useRouter().query.roomId;
    const [peer, setPeer] = useState(null)
    const [myId, setMyId] = useState('')
    const isPeerSet = useRef(false)

    useEffect(() => {
        if (isPeerSet.current || !roomId || !socket) return;
        isPeerSet.current = true;
        let myPeer;
        (async function initPeer() {
            try {
                const Peer = (await import('peerjs')).default
                myPeer = new Peer()
                setPeer(myPeer)

                myPeer.on('open', (id) => {
                    console.log(`your peer id is ${id}`)
                    setMyId(id)
                    socket?.emit('join-room', roomId, id)
                })

                myPeer.on('error', (err) => {
                    console.error('Peer error:', err)
                })

                myPeer.on('disconnected', () => {
                    console.log('Peer disconnected')
                })

                myPeer.on('close', () => {
                    console.log('Peer connection closed')
                })
            } catch (err) {
                console.error('Failed to initialize Peer:', err)
            }
        })()
        
        return () => {
            if (myPeer && !myPeer.destroyed) {
                myPeer.destroy()
            }
        }
    }, [roomId, socket])

    // Отдельный эффект для очистки при размонтировании
    useEffect(() => {
        return () => {
            if (peer && !peer.destroyed) {
                peer.destroy()
            }
        }
    }, [peer])

    return {
        peer,
        myId
    }
}

export default usePeer;