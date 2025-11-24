import Homey from 'homey';

export function registerFlowCards(app: Homey.App) {
    // Register generic curve calculation card
    app.homey.flow.getActionCard('calculate_curve_value')
        .registerRunListener(async (args, state) => {
            const inputValue = args.input_value;
            const curveString = args.curve;

            app.log(`Calculating curve value. Input: ${inputValue}, Curve: ${curveString}`);

            // Parse the curve string
            // Format: "[operator] threshold : value"
            // Example: "> 18 : 20", "<= 5 : 10", "15 : 25" (defaults to >=)

            // Split by comma or newline
            const entries = curveString.split(/[\n,]+/);

            let resultValue = null;

            for (const entry of entries) {
                // Clean up the entry
                const cleanEntry = entry.trim();
                if (!cleanEntry) continue;

                // Split into condition and value parts
                const parts = cleanEntry.split(':');
                if (parts.length !== 2) continue;

                const conditionPart = parts[0].trim();
                const valuePart = parseFloat(parts[1].trim());

                if (isNaN(valuePart)) continue;

                // Parse operator and threshold from condition part
                // Regex to match operator (optional) and number
                // Matches: ">=", "<=", ">", "<", "==", "!=" or nothing
                const match = conditionPart.match(/^([><=!]+)?\s*(-?[\d\.]+)/);

                if (match) {
                    const operator = match[1] || '>='; // Default to >= if no operator specified
                    const threshold = parseFloat(match[2]);

                    if (!isNaN(threshold)) {
                        let matchFound = false;

                        switch (operator) {
                            case '>': matchFound = inputValue > threshold; break;
                            case '>=': matchFound = inputValue >= threshold; break;
                            case '<': matchFound = inputValue < threshold; break;
                            case '<=': matchFound = inputValue <= threshold; break;
                            case '==': matchFound = inputValue === threshold; break;
                            case '!=': matchFound = inputValue !== threshold; break;
                            default: matchFound = inputValue >= threshold; // Should not happen given regex
                        }

                        if (matchFound) {
                            resultValue = valuePart;
                            break; // Stop at first match
                        }
                    }
                } else if (conditionPart.toLowerCase() === 'default' || conditionPart === '*') {
                    // Support a catch-all "default" or "*" case
                    resultValue = valuePart;
                    break;
                }
            }

            if (resultValue !== null) {
                app.log(`Calculated result value: ${resultValue}`);
                return {
                    result_value: resultValue
                };
            } else {
                // If no match found, we throw an error. 
                // User should define a default case if they want one.
                throw new Error('No matching curve condition found for input value: ' + inputValue);
            }
        });
}
