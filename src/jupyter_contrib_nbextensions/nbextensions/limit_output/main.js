// Restrict output in a codecell to a maximum length

define([
    'notebook/js/outputarea',
    'notebook/js/codecell',
    'services/config',
    'base/js/utils'
], function(oa, cc, configmod, utils) {
    "use strict";

    var base_url = utils.get_body_data("baseUrl");
    var config = new configmod.ConfigSection('notebook', {base_url: base_url});

    // define default values for config parameters
    var params = {
        // maximum number of characters the output area is allowed to print
        limit_output : 10000,
        // message to print when output is limited
        limit_output_message : '<b>limit_output extension: Maximum message size of {limit_output_length} exceeded with {output_length} characters</b>'
    };

    // to be called once config is loaded, this updates default config vals
    // with the ones specified by the server's config file
    var update_params = function() {
        for (var key in params) {
            if (config.data.hasOwnProperty(key) ){
                params[key] = config.data[key];
            }
        }
    };

    function is_finite_number (n) {
        n = parseFloat(n);
        return !isNaN(n) && isFinite(n);
    }

    config.loaded.then(function() {
        update_params();
        // sometimes limit_output metadata val can get stored as a string
        params.limit_output = parseFloat(params.limit_output);

        var old_handle_output = oa.OutputArea.prototype.handle_output;
        oa.OutputArea.prototype.handle_output = function (msg) {
            if (msg.header.msg_type.match("stream|execute_result|display_data")) {
                var count = 0;
                if (msg.header.msg_type === "stream") {
                    count = String(msg.content.text).length;
                } else {
                    count = Math.max(
                        (msg.content.data['text/plain'] === undefined) ? 0 : String(msg.content.data['text/plain']).length,
                        (msg.content.data['text/html'] === undefined) ? 0 : String(msg.content.data['text/html']).length );
                }
                var MAX_CHARACTERS = params.limit_output;
                var cell = this.element.closest('.cell').data('cell');
                if (is_finite_number(cell.metadata.limit_output)) {
                    MAX_CHARACTERS = parseFloat(cell.metadata.limit_output);
                }
                if (count > MAX_CHARACTERS) {
                    console.log("limit_output: output", count, "exceeded", MAX_CHARACTERS, "characters. Further output muted.");
                    if (msg.header.msg_type === "stream") {
                        msg.content.text = msg.content.text.substr(0, MAX_CHARACTERS);
                    } else {
                        if (msg.content.data['text/plain'] !== undefined) {
                            msg.content.data['text/plain'] = msg.content.data['text/plain'].substr(0, MAX_CHARACTERS);
                        }
                        if (msg.content.data['text/html'] !== undefined) {
                            msg.content.data['text/html'] = msg.content.data['text/html'].substr(0, MAX_CHARACTERS);
                        }
                    }

                    // allow simple substitutions for output length for quick debugging
                    var limitmsg = params.limit_output_message.replace("{limit_output_length}", MAX_CHARACTERS)
                                                              .replace("{output_length}", count);
                    this.append_output({
                        "output_type": "display_data",
                        "metadata": {}, // included to avoid warning
                        "data": {"text/html": limitmsg},
                    });
                }
            }
            return old_handle_output.apply(this, arguments);
        };

        var old_clear_output = oa.OutputArea.prototype.clear_output;
        oa.OutputArea.prototype.clear_output = function () {
            // reset counter on execution.
            this.data('limit_output_count', 0);
            return old_clear_output.apply(this, arguments);
        };
    });

    var load_ipython_extension = function() {
        config.load();
    };

    return {
        load_ipython_extension : load_ipython_extension
    };
});
