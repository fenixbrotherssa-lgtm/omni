const CONFIG = {
    ENV: 'development',
    SERVER_ADDRESS: 'omnicore.casrodsoft.com',
    PORT: 3636, // OMNI CORE backend

    getApiUrl() {
        const isDomain = this.SERVER_ADDRESS.includes('.') && !/[0-9]$/.test(this.SERVER_ADDRESS);
        const protocol = isDomain ? 'https' : 'http';
        const suffix = isDomain ? '' : `:${this.PORT}`;
        return `${protocol}://${this.SERVER_ADDRESS}${suffix}/api`;
    }
};

module.exports = CONFIG;
