function isYouTubeLink(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return youtubeRegex.test(url);
}

function getStartTime(url) {
    try {
        const ytURL = new URL(url);
        if(ytURL.searchParams.has("t")) {
            return Number(ytURL.searchParams.get("t"));
        }
        return null;
    } catch(error) {
        return null;
    }
}

module.exports = { isYouTubeLink, getStartTime };