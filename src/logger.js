function write(level, message) {
	const timestamp = new Date().toISOString();
	console[level](`[${timestamp}] ${message}`);
}

module.exports = {
	info(message) {
		write('log', message);
	},
	warn(message) {
		write('warn', message);
	},
	error(message) {
		write('error', message);
	}
};
