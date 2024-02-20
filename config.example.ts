/**
 *  (0) Переименовать файл в config.ts
 *  (0) Переименовать папку dataExample в data
 *  (1) Загрузите приватные ключи или/и мнемоники в файл ./data/starknetData.txt
 *  (2) Загрузите адреса для вывода ETH в файл ./data/addressesToWithdrawETH.txt
 *  (3) Загрузите адреса для вывода STRK в файл ./data/addressesToWithdrawSTRK.txt
 *  (4) Создайте базу данных нажав Create db
 *  (5) Запустите программу используя Run Claimer
 *
 *  {@link rpc} - Вставляете сюда рпц старка, при ошибке будет браться другая
 *  {@link ERC20} - Вставьте рпц ERC20
 *
 *  {@link brokenMnemo} - Настройка исключительно для проминта, остальным ставить false
 *
 *  {@link delay} - Задержка между действиями в СЕКУНДАХ
 *  {@link maxRetry} - Максимальное количество попыток отправки транзакции
 *  {@link maxGas} - Максимальное количество GWEI в ERC20
 *
 *  {@link TGToken} - Токен бота для логов
 *  {@link ChatsID} - ID чатов для логов
 *
 *  {@link shouldWithdrawETH} - Выводить ли ETH
 *  {@link shouldWithdrawSTRK} - Выводить ли STRK
 *  {@link keepBalanceETH} - Оставлять ли баланс ETH, если нет, то поставить [0, 0]
 *
 *  {@link shuffleWallets} - Перемешивать ли кошельки
 *
 *  {@link autoSellOnDex} - Продавать ли STRK на DEX
 *
 *  {@link amountAutoSellFrom} - Количество ETH выше которого мы будем продавать на дексе
 *
 *  (*) - В случае ошибки, приватный ключ запишется в ./data/error/pkError/txt
 *  (*) - В меню так же можно выбрать Create Excel Table которая создаст .xlsx файл с данными по клейму для каждого ака
 */

export class General {

    static rpc: string[] = [
        '',
    ];

    static ERC20: string = '';

    static brokenMnemo: boolean = false;

    static delay: number[] = [10, 15];
    static maxRetry: number = 3;
    static maxGas: number = 30;

    static TGToken: string = '';
    static ChatsID: string[] = [''];

    static shouldWithdrawETH: boolean = true;
    static shouldWithdrawSTRK: boolean = true;
    static keepBalanceETH: number[] = [0, 0];

    static shuffleWallets: boolean = false;

    static autoSellOnDex: boolean = true;
    static amountAutoSellFrom: number = 0.1;
}
