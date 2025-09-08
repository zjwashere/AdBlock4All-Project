#Code generated with ChatGPT, will be used for inspiration

import json
import re
import sys

def parse_easylist_line(line, rule_id):
    """
    Convert one EasyList rule into a Chrome declarativeNetRequest rule.
    Returns None if the line is unsupported.
    """

    line = line.strip()

    # Skip comments and cosmetic rules
    if not line or line.startswith("!") or "##" in line or "#@#" in line or '#?#' in line:
        return None

    # Exceptions (whitelist) start with @@ -> Chrome uses "allow"
    action_type = "block"
    if line.startswith("@@"):
        action_type = "allow"
        line = line[2:]

    condition = {"urlFilter": line}

    # Handle resource type modifiers like $script,$image
    if "$" in line:
        url_part, modifiers = line.split("$", 1)
        if url_part != "":
            condition["urlFilter"] = url_part
        else:
            return None
        types = []
        for m in modifiers.split(","):
            m = m.strip()
            if m == "script":
                types.append("script")
            elif m == "image":
                types.append("image")
            elif m == "stylesheet":
                types.append("stylesheet")
            elif m == "xmlhttprequest":
                types.append("xmlhttprequest")
        if types:
            condition["resourceTypes"] = types

    rule = {
        "id": rule_id,
        "priority": 1,
        "action": {"type": action_type},
        "condition": condition
    }

    return rule


def convert_easylist_to_json(easylist_path, output_path="rules.json"):
    rules = []
    with open(easylist_path, "r", encoding="utf-8") as f:
        rule_id = 1
        for line in f:
            rule = parse_easylist_line(line, rule_id)
            if rule:
                rules.append(rule)
                rule_id += 1

    with open(output_path, "w", encoding="utf-8") as out:
        json.dump(rules, out, indent=2)

    print(f"✅ Converted {len(rules)} rules to {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python converter.py <easylist.txt> [output.json]")
        sys.exit(1)

    easylist_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "rules.json"
    convert_easylist_to_json(easylist_path, output_path)
