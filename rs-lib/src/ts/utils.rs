pub fn sanitize_ts_identifier(name: &str) -> String {
    let mut output = String::new();
    for (index, character) in name.chars().enumerate() {
        let valid = if index == 0 {
            character == '_'
                || character == '$'
                || character.is_ascii_alphabetic()
        } else {
            character == '_'
                || character == '$'
                || character.is_ascii_alphanumeric()
        };
        if valid {
            output.push(character);
        } else {
            output.push('_');
        }
    }
    if output.is_empty() {
        "_AnonymousType".to_string()
    } else {
        output
    }
}

pub fn to_jsdoc(docs: &str) -> String {
    let docs = docs.replace("*/", "* /");
    let mut output = String::from("/**\n");
    for line in docs.lines() {
        output.push_str(" *");
        if !line.is_empty() {
            output.push(' ');
            output.push_str(line);
        }
        output.push('\n');
    }
    output.push_str(" */");
    output
}
