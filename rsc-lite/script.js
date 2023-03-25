/* DEBUG VARIABLES */
const CLEAR_DATABASE_ON_LOAD = false

async function main() {
    await replit.init({ permissions: [] })

    const database = await replit.replDb
    
    if (CLEAR_DATABASE_ON_LOAD) {
        await database.list().forEach(async key => {
            await database.del({ key: key })
        })
    }

    const spotify = {
        secret:         await database.get({ key: 'spotify_client_secret '})
        , id:           await database.get({ key: 'spotify_client_id' })
        , accessToken:  await database.get({ key: 'spotify_access_token' })
        , refreshToken: await database.get({ key: 'spotify_refresh_token' })
    }

    const showLoadingPage = (message = "Loading...") => {
        document.querySelector('#loading-screen #loading-screen-message').innerText = message
        document.querySelector('#loading-screen').classList.remove('hidden')
    }

    const focusDocumentSection = elementID => {
        document.querySelector('section.active').classList.remove('active')
        document.querySelector('#' + elementID).classList.add('active')
    }

    const waitForClientDataSubmission = callback => {
        document.querySelector("#spotify-client-data-form-submit").addEventListener('click', () => {
            
        })
    }

    const startClientData

    if (window.self === window.top) {
        /* extension is opened in it's own page */
    } else {
        /* extension is running within an iframe */
        if (spotify.secret && spotify.id) {
            
        } else {
            /* user needs to supply their spotify API data  */
            focusDocumentSection('spotify-client-data-form')
            waitForClientDataSubmission(clientData => {
                
            })
        }
    }
}

main()