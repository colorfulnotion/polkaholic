.PHONY: ext

GOBIN = $(shell pwd)/bin
GO ?= latest

ui:
	gcloud compute instances list --filter='name ~ polkaholic-*' --format "get(networkInterfaces[0].networkIP)" > yaml/hosts_ui
	ansible-playbook -u root -i yaml/hosts_ui yaml/polkaholic_ui.yaml
	@echo "Pushed Polkaholic to all 3 endpoints!  Visit https://polkaholic.io"

ui_us:
	gcloud compute instances list --filter='name ~ polkaholic-us*' --format "get(networkInterfaces[0].networkIP)" > yaml/hosts_ui_us
	ansible-playbook -u root -i yaml/hosts_ui_us yaml/polkaholic_ui.yaml
	@echo "Pushed Polkaholic!  Visit https://api-us.polkaholic.io"

ui_eu:
	gcloud compute instances list --filter='name ~ polkaholic-eu*' --format "get(networkInterfaces[0].networkIP)" > yaml/hosts_ui_eu
	ansible-playbook -u root -i yaml/hosts_ui_eu yaml/polkaholic_ui.yaml
	@echo "Pushed Polkaholic!  Visit https://api-eu.polkaholic.io"

ui_as:
	gcloud compute instances list --filter='name ~ polkaholic-as*' --format "get(networkInterfaces[0].networkIP)" > yaml/hosts_ui_as
	ansible-playbook -u root -i yaml/hosts_ui_as yaml/polkaholic_ui.yaml
	@echo "Pushed Polkaholic!  Visit https://api-as.polkaholic.io"

acalastart:
	ansible-playbook -u root -i yaml/hosts_acala yaml/acalastart.yaml
	@echo "Started crawlers on acala"

acalastop:
	ansible-playbook -u root -i yaml/hosts_acala yaml/acalastop.yaml
	@echo "Stopped crawlers on acala"

kusamastart:
	ansible-playbook -u root -i yaml/hosts_kusama yaml/kusamastart.yaml
	@echo "Started crawlers on kusama"

kusamastop:
	ansible-playbook -u root -i yaml/hosts_kusama yaml/kusamastop.yaml
	@echo "Stopped crawlers on kusama"

karurastart:
	ansible-playbook -u root -i yaml/hosts_karura yaml/karurastart.yaml
	@echo "Started crawlers on karura"

karurastop:
	ansible-playbook -u root -i yaml/hosts_karura yaml/karurastop.yaml
	@echo "Stopped crawlers on karura"

astarstart:
	ansible-playbook -u root -i yaml/hosts_astar yaml/astarstart.yaml
	@echo "Started crawlers on astar"

astarstop:
	ansible-playbook -u root -i yaml/hosts_astar yaml/astarstop.yaml
	@echo "Stopped crawlers on astar"

moonbeamstart:
	ansible-playbook -u root -i yaml/hosts_moonbeam yaml/moonbeamstart.yaml
	@echo "Started crawlers on moonbeam"

moonbeamstop:
	ansible-playbook -u root -i yaml/hosts_moonbeam yaml/moonbeamstop.yaml
	@echo "Stopped crawlers on moonbeam"

parallelstart:
	ansible-playbook -u root -i yaml/hosts_parallel yaml/parallelstart.yaml
	@echo "Started crawlers on parallel"

parallelstop:
	ansible-playbook -u root -i yaml/hosts_parallel yaml/parallelstop.yaml
	@echo "Stopped crawlers on parallel"

polkadotstart:
	ansible-playbook -u root -i yaml/hosts_polkadot yaml/polkadotstart.yaml
	@echo "Started crawlers on polkadot"

polkadotstop:
	ansible-playbook -u root -i yaml/hosts_polkadot yaml/polkadotstop.yaml
	@echo "Stopped crawlers on polkadot"

shidenstart:
	ansible-playbook -u root -i yaml/hosts_shiden yaml/shidenstart.yaml
	@echo "Started crawlers on shiden"

shidenstop:
	ansible-playbook -u root -i yaml/hosts_shiden yaml/shidenstop.yaml
	@echo "Stopped crawlers on shiden"

cdmain:
	ssh parallel "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh acala    "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh shiden   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh astar    "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh moonbeam "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh polkadot "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh karura   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh kusama   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh bifrost-ksm  "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"
	ssh litentry     "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D main; git pull; git checkout main"

cddev:
	ssh parallel "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh acala    "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh shiden   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh astar    "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh moonbeam "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh polkadot "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh karura   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh kusama   "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh bifrost-ksm  "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"
	ssh litentry     "cd /root/go/src/github.com/colorfulnotion/polkaholic; git checkout swap; git branch -D dev; git pull; git checkout dev"

indexers:
	make parallelstop
	make parallelstart
	make polkadotstop
	make polkadotstart
	make acalastop
	make acalastart
	make moonbeamstop
	make moonbeamstart
	make astarstop
	make astarstart
	make shidenstop
	make shidenstart
	make karurastop
	make karurastart
	make kusamastop
	make kusamastart

start:
	make parallelstart
	make polkadotstart
	make acalastart
	make moonbeamstart
	make astarstart
	make shidenstart
	make kusamastart
	make karurastart

stop:
	make parallelstop
	make polkadotstop
	make acalastop
	make moonbeamstop
	make astarstop
	make shidenstop
	make kusamastop
	make karurastop

gitlog:
	ssh acala "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh polkadot "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh moonbeam "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh shiden "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh karura "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh astar "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh parallel "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh kusama "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh karura "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh bifrost-ksm "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh litentry "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "
	ssh moonriver "cd ~/go/src/github.com/colorfulnotion/polkaholic/substrate; git log | head -3 "

beauty:
	js-beautify -r index.js polkaholic.js substrate/*.js substrate/chains/*.js public/account.js public/asset.js public/chain.js public/chains.js public/tx.js public/uihelper.js public/wallet.js public/query.js substrate/test/*.js test/test.js
	@echo "Done beautifying Polkaholic!"
