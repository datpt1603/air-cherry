const fs = require('fs');
const path = require('path');
const axios = require('axios');
const readline = require('readline');
const colors = require('colors');
const qs = require('qs');

class Cherry {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36 Edg/129.0.0.0',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Origin': 'https://cherrygame.io',
            'Referer': 'https://cherrygame.io/',
            'accept-language': 'en-GB,en;q=0.9,en-US;q=0.8,ja;q=0.7',
            'Sec-Ch-Ua': '"Microsoft Edge";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Android"',
        };

        this.initDataUrl = 'https://whale-app-ddbre.ondigitalocean.app/gateway-api/initdata';
        this.clickerUrl = 'https://whale-app-ddbre.ondigitalocean.app/userconfig/clicker';
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`);
        }
    }

    async waitWithCountdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Đã hoàn thành tất cả tài khoản, chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async countdown(t) {
        for (let i = t; i > 0; i--) {
            const hours = String(Math.floor(i / 3600)).padStart(2, '0');
            const minutes = String(Math.floor((i % 3600) / 60)).padStart(2, '0');
            const seconds = String(i % 60).padStart(2, '0');
            process.stdout.write(colors.white(`[*] Cần chờ ${hours}:${minutes}:${seconds}     \r`));
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        process.stdout.write('                                        \r');
    }

    async getData(initData) {
        try {
            const { data } = await axios.get(this.initDataUrl, { headers: {...this.headers, 'authorization': `Bearer ${initData}`, 'content-type': 'application/json'} });
            return data;
        } catch (error) {
            this.log(`Lỗi khi lấy dữ liệu: ${error.message}`, 'error');
            return null;
        }
    }

    async clicker(initData, dataGame) {
        try {
            let maxPreCoin = dataGame.gamelogic.maxPreCoin;
            let payload = qs.stringify({
                'points': maxPreCoin,
                'boostUsage': maxPreCoin,
                'clickcount': '0' 
            });

            const { data, status } = await axios.post(this.clickerUrl, payload, { headers: {...this.headers, 'Authorization': `Bearer ${initData}`, 'content-type': 'application/x-www-form-urlencoded'} });
            if (status == 201) {
                this.log(`Đã click ${dataGame.userProfile.full_name} - thành công poin: ${data}`, 'success');
            }
        } catch (error) {
            this.log(`Lỗi khi click: ${error.message}`, 'error');
        }
    }

    async completeTask(initData, dataGame) {
        const completedTasks = dataGame.completedTasks;
            const tasks = dataGame.allTask.filter(task => !completedTasks.some(complete => complete.task_id === task.task_id));
            const userProfile = dataGame.userProfile;

            for (const task of tasks) {
                try {
                    let completeTaskUrl = `https://whale-app-ddbre.ondigitalocean.app/tasks/${task.task_id}/check`;
                    console.log(`Thực hiện nhiệm vụ: ${task.task_id} - ${task.title}`);
                    const { data, status } = await axios.post(completeTaskUrl, {
                        completed: {
                            done: true,
                            finishedTask: {
                                task_id: task.task_id,
                                created_at: new Date().toISOString(),
                                id: task.task_id,
                                telegram_id: userProfile.telegram_id
                            }
                        }
                    }, { headers: {...this.headers, 'Authorization': `Bearer ${initData}`} });
                    if (status === 201) {
                        this.log(`Hoàn thành nhiệm vụ: ${task.task_id} - ${task.title}`, 'success');
                    }
                } catch (error) {
                    this.log(`Lỗi khi hoàn thành nhiệm vụ: ${error.message}`, 'error');
                }
            }
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const initDataList = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        while (true) {
            for (let no = 0; no < initDataList.length; no++) {
                const initData = initDataList[no];
                try {
                    const dataGame = await this.getData(initData);
                    if (dataGame) {
                        console.log(`Xử lý tài khoản ${no + 1} fullname: ${dataGame.userProfile.full_name}`);
                        await this.clicker(initData, dataGame);
                        await this.completeTask(initData, dataGame);
                    }
                } catch (error) {
                    this.log(`Lỗi khi xử lý tài khoản ${no + 1}: ${error.message}`, error);
                }
            }

            await this.waitWithCountdown(Math.floor(300));
        }
    }
}

if (require.main === module) {
    const cherry = new Cherry();
    cherry.main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}