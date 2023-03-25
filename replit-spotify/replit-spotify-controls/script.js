/* URL for the auth server, cannot have trailing "/" */
const AUTH_SERVER_URL = 'https://rs-auth-server.zavexeon.repl.co' 

/* debugging variables */
const RESET_ON_LOAD = false
const BYPASS_PREMIUM_CHECK = false

async function main() {
    await replit.init({ permissions: [] })
    
    const replDb = await replit.replDb
    let isAppStarted = false

    if (RESET_ON_LOAD) {
        await replDb.del({ key: 'spotify_refresh_token' })
        await replDb.del({ key: 'spotify_access_token' })
    }
    
    const spotify = {
        accessToken: await replDb.get({ key: 'spotify_access_token' })
        , refreshToken: await replDb.get({ key: 'spotify_refresh_token' })
    }
    
    const generateFixedLengthNumber = length => {
        const numberArray = []
        for (let i = 0; i < length; i++) {
            numberArray.push(
                i === 0 ? 
                Math.floor(Math.random() * 9) + 1 :
                Math.floor(Math.random() * 10)
            )
        }
        return Number(numberArray.join(''))
    }
    
    /* generates a pseudo-random id encoded to Base64 */
    const generateID = () => btoa(String(generateFixedLengthNumber(128) + Date.now()))
    
    const getNewToken = async () => {
        const response = await fetch(`${AUTH_SERVER_URL}/get_refresh_token?${new URLSearchParams({ refresh_token: spotify.refreshToken })}`)
    
        if (response.status === 200) {
            const body = await response.json()
            return body.access_token
        } else {
            throw 'unable to retrieve new access token'
        }
    }
    
    const apiCall = (method, endpoint, callback, body) => {
        let iteration = 0
        
        const makeRequest = () => {
            const requestTimeout = window.setTimeout(async () => {
                const request = {
                    method: method
                    , headers: {
                        'Content-Type': 'application/json'
                        , 'Authorization': `Bearer ${spotify.accessToken}`
                    }
                }
                if (body) request.body = body
            
                const response = await fetch('https://api.spotify.com/v1' + endpoint, request)
    
                if (response.status === 200 || response.status === 204) {
                    if (callback) {
                        response.json().then(json => callback(json)).catch(() => callback({}))
                    }
                    window.clearTimeout(requestTimeout)
                } else if (response.status === 401) {
                    iteration++
                    let newToken = await getNewToken()
                    spotify.accessToken = newToken
                    await replDb.set({ key: 'spotify_access_token', value: newToken })
                    makeRequest()
                } else {
                    iteration++
                    makeRequest()
                }
            }, Math.min((2 ** iteration) + Math.floor(Math.random() * 1000), 10000))
        }
    
        makeRequest()
    }

    const pollForAccessKey = (uuid, state, callback, iteration=0 ) => {
        const pollTimeout = window.setTimeout(async () => {
            const response = await fetch(`${AUTH_SERVER_URL}/retrieve_auth_data/${uuid}/${state}`)

            if (response.status === 200) {
                const body = await response.json()
                
                await replDb.set({ key: 'spotify_access_token', value: body.access_token })
                await replDb.set({ key: 'spotify_refresh_token', value: body.refresh_token })

                spotify.accessToken = body.access_token
                spotify.refreshToken = body.refresh_token

                callback()
                window.clearTimeout(pollTimeout)
            } else {
                
                pollForAccessKey(uuid, state, callback, iteration + 1)
            }
        }, Math.min((2 ** iteration) + Math.floor(Math.random() * 1000), 10000))
    }

    const formatMsToTimestamp = ms => {
        const date = new Date(ms)
        return `${date.getUTCHours() === 0 ? '' : date.getUTCHours() + ':'}${date.getUTCMinutes()}:${date.getUTCSeconds().toString().padStart(2, '0')}`
    }

    const startApp = () => {
        isAppStarted = true
        document.getElementById('user-message').innerHTML = 'Loading UI...'
        
        const playPauseButtonIcon = document.getElementById('play-pause-icon')
        const shuffleButtonIcon = document.getElementById('shuffle-icon')
        const repeatButtonIcon = document.getElementById('repeat-icon')
        let isPlaying
        let isShuffled
        let isRepeated
        let isUserPremium
        
        let lastPlayerState
        const updateCurrentlyPlaying = callback => {
            setTimeout(() => {
                apiCall('get', '/me/player', async response => {
                    if (lastPlayerState === response) return
                
                    lastPlayerState = response 
                    
                    response.is_playing ? playPauseButtonIcon.src = './images/pause.png' : playPauseButtonIcon.src = './images/play.png'
                    response.shuffle_state ? shuffleButtonIcon.src = './images/shuffle-toggled.png' : shuffleButtonIcon.src = './images/shuffle.png'
                    response.repeat_state === 'off' ? repeatButtonIcon.src = './images/repeat.png' : repeatButtonIcon.src = './images/repeat-toggled.png'
                    isPlaying = response.is_playing
                    isShuffled = response.shuffle_state 
                    isRepeated = response.repeat_state === 'off' ? false : true
                    
                    document.getElementById('album-cover').src = response.item.album.images[0].url
                    document.getElementById('album-name').innerText = response.item.album.name
                    document.getElementById('album-name').href = response.item.album.external_urls.spotify      
                    document.getElementById('track-name').innerText = response.item.name
                    document.getElementById('track-name').href = response.item.external_urls.spotify
                    document.getElementById('song-progress').value = (response.progress_ms / response.item.duration_ms) * 100
                    document.getElementById('elapsed-song-time').innerText = formatMsToTimestamp(response.progress_ms)
                    document.getElementById('total-song-time').innerText = formatMsToTimestamp(response.item.duration_ms)
                    document.getElementById('spotify-content-link').href = response.item.external_urls.spotify

                    const artistNamesElement = document.getElementById('artist-names')
                    artistNamesElement.innerHTML = ''
                    
                    response.item.artists.forEach((artist , index) =>  {
                        let artistLinkElement = document.createElement('a')
                        
                        artistLinkElement.innerText = artist.name
                        artistLinkElement.href = artist.external_urls.spotify 
                        artistLinkElement.target = "_blank"
                        artistLinkElement.classList.add('artist-link')

                        artistNamesElement.appendChild(artistLinkElement)

                        if (index !== response.item.artists.length - 1) {
                            let commaSpan = document.createElement('span')
                            commaSpan.innerText = ', '
                            artistNamesElement.appendChild(commaSpan)
                        }
                    })

                    if(callback) callback()
                })
            }, 1500)
        }

        document.getElementById('previous').addEventListener('click', () => {
            apiCall('post', '/me/player/previous')
            updateCurrentlyPlaying()
        })

        document.getElementById('play-pause').addEventListener('click', () => {
            isPlaying ? apiCall('put', '/me/player/pause') : apiCall('put', '/me/player/play')
            updateCurrentlyPlaying()
        })
        
        document.getElementById('next').addEventListener('click', () => {
            apiCall('post', '/me/player/next') 
            updateCurrentlyPlaying()
        })

        document.getElementById('shuffle').addEventListener('click', () => {
            isShuffled ? apiCall('put', '/me/player/shuffle?state=false') : apiCall('put', '/me/player/shuffle?state=true') 
            updateCurrentlyPlaying()
        })

        document.getElementById('repeat').addEventListener('click', () => {
            isRepeated ? apiCall('put', '/me/player/repeat?state=off') : apiCall('put', '/me/player/repeat?state=track') 
            updateCurrentlyPlaying()
        })

        const startUpdateEverySecond = () => {
            window.setInterval(() => {
                updateCurrentlyPlaying()
            }, 1000)
        }

        const pollUntilPlaying = (iteration=0) => {
            const pollTimeout = window.setTimeout(async () => {
                apiCall('get', '/me/player', async response => {
                    if (response.is_playing) {
                        updateCurrentlyPlaying(() => {
                            document.getElementById('loading-page').hidden = document.getElementById('loading-page').hidden = true
                            document.querySelectorAll('.start-hidden').forEach(element => element.classList.remove('start-hidden'))
                        })
                        startUpdateEverySecond()
                        window.clearTimeout(pollTimeout)
                    } else {
                        document.getElementById('user-message').innerText = 'Start playing something on Spotify to get Started!'
                        pollUntilPlaying(iteration + 1)
                    }
                })
            }, Math.min((2 ** iteration) + Math.floor(Math.random() * 1000), 10000))
        }
        
        apiCall('get', '/me', user => { 
            if (!BYPASS_PREMIUM_CHECK) {
                if (user.product !== 'premium') document.querySelectorAll('.premium').forEach(element => element.hidden = true)
            }

            pollUntilPlaying()
        })
    }

    if (window.self === window.top) {
        const uuid = new URLSearchParams(window.location.search).get('uuid')
        if (uuid && uuid.length > 1) {
            window.location.replace(`${AUTH_SERVER_URL}/login?${new URLSearchParams({ uuid: uuid })}`)
        } else {
            document.body.innerHTML = 'Invalid uuid querystring'
        }
    } else {
        const resetTimeout = window.setTimeout(() => {
            if (!isAppStarted) {
                const resetButton = document.getElementById('reset-button')
                
                resetButton.addEventListener('click', async () => {
                    await replDb.del({ key: 'spotify_refresh_token' })
                    await replDb.del({ key: 'spotify_access_token' })
                    
                    resetButton.hidden = true
                    document.getElementById('user-message').hidden = true
                    document.getElementById('reset-message').innerText = 'The extension has been reset. You may refresh the extension in Replit now.'
                })
                
                document.getElementById('reset-option').hidden = false 
            }
            clearTimeout(resetTimeout)
        }, 30000)
        
        if (spotify.accessToken && spotify.refreshToken) {
            startApp()
        } else {   
            const state = generateID()
            fetch(`${AUTH_SERVER_URL}/get_new_id/${state}`).then(async response => {
                const body = await response.json()
                await replDb.set({ key: 'uuid', value: body.uuid })
                
                document.getElementById('user-message').innerHTML = `Click <a target="_blank" href=${window.location.href}?${new URLSearchParams({ uuid: body.uuid })}>here</a> to authorize with Spotify.<br><br>If you have already authenticated with Spotify you may refresh the extension.`
                
                pollForAccessKey(body.uuid, state, keys => {
                    startApp()
                })
            })
        } 
    }
}

main()