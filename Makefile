.PHONY: generate clean mapping mcd serve

NODE_FLAGS = --no-warnings --experimental-transform-types
OUTPUT_DIR = dist/calendars
SERVE_PORT = 8000

generate:
	node $(NODE_FLAGS) scripts/generate-all.ts

serve:
	python3 -m http.server $(SERVE_PORT) --directory $(OUTPUT_DIR)

mapping:
	node $(NODE_FLAGS) scripts/generate-line-station-mapping.ts

clean:
	rm -rf $(OUTPUT_DIR)

mcd:
	npx @mermaid-js/mermaid-cli -i MCD.mmd -o MCD.svg
	npx @mermaid-js/mermaid-cli -i MCD.mmd -o MCD.png -w 1600 -H 1200
