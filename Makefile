.PHONY: generate clean mapping

NODE_FLAGS = --no-warnings --experimental-transform-types

generate:
	node $(NODE_FLAGS) scripts/generate-all.ts

mapping:
	node $(NODE_FLAGS) scripts/generate-line-station-mapping.ts

clean:
	rm -rf dist/calendars

mcd:
	npx @mermaid-js/mermaid-cli -i MCD.mmd -o MCD.svg
	npx @mermaid-js/mermaid-cli -i MCD.mmd -o MCD.png -w 1600 -H 1200
