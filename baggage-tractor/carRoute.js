// TODO: захардкодить parkingSpot для самолётов ?

// Точка спавна новой машинки, она меняется в зависимости от кол-ва машинок
let spawnRow = 24
let spawnCol = 7;

// Центр самолётно-обслужнической площадки
const planeZoneRow = 19;
const planeZoneCol = 42;

// Точка выезда машинки
const dispatchRow = 23;
const dispatchCol = 11;

let returnRow;
let returnCol;

// Массив с координатами дорожки (строка, столбец) и "критичностью" клеточки
const road_1 = [];
const road_2 = [];
const road_3 = [];
const road_4 = [];
const road_5 = [];
const road_6 = [];
const road_7 = [];
const road_8 = [];

// Места парковки самолётов
const parkingSpots = [
    [13, 38],
    [15, 38],
    [17, 38],
    [19, 38],
    [21, 38],
    [13, 46],
    [15, 46],
    [17, 46],
    [19, 46],
    [21, 46],
    [23, 46]
];

let lastIndex;
road_1.push([[dispatchRow, dispatchCol, true]]);
const roadLength_1 = 10;
for (let i = 1; i < roadLength_1 + 1; i++)  // Поддорожка 1
    road_1.push([dispatchRow, dispatchCol + i, true]);



lastIndex = road_1.length - 1;
const roadLength_2_1 = 2;
for (let i = 1; i < roadLength_2_1 + 1; i++)    // Поддорожка 2, часть 1
    road_2.push([road_1[lastIndex][0] - i, road_1[lastIndex][1], true]);



lastIndex = road_2.length - 1;
road_2.push([road_2[lastIndex][0] - 1, road_2[lastIndex][1], false]);  // Поддорожка 2, 1-е пересечение с дорожкой СПП

lastIndex = road_2.length - 1;
const roadLength_2_2 = 2;
for (let i = 1; i < roadLength_2_2 + 1; i++) // Поддорожка 2, часть 2
    road_2.push([road_2[lastIndex][0] - i, road_2[lastIndex][1], true]);

lastIndex = road_2.length - 1;
road_2.push([road_2[lastIndex][0] - 1, road_2[lastIndex][1], false]);  // Поддорожка 2, 2-е пересечение с дорожкой СПП

lastIndex = road_2.length - 1;
const roadLength_2_3 = 4;
for (let i = 1; i < roadLength_2_3 + 1; i++) // Поддорожка 2, часть 3
    road_2.push([road_2[lastIndex][0] - i, road_2[lastIndex][1], true]);

lastIndex = road_2.length - 1;
const roadLength_3 = 2;
for (let i = 1; i < roadLength_3 + 1; i++) // Поддорожка 3
    road_3.push([road_2[lastIndex][0], road_2[lastIndex][1] + i, true]);

lastIndex = road_2.length - 1;
const roadLength_4_1 = 3;
for (let i = 1; i < roadLength_4_1 + 1; i++) // Поддорожка 4, часть 1
    road_3.push([road_2[lastIndex][0] + i, road_2[lastIndex][1], true]);

lastIndex = road_2.length - 1;
road_3.push([road_2[lastIndex][0] + 1, road_2[lastIndex][1], false]);  // Поддорожка 4, пересечение с дорожкой СПП

lastIndex = road_2.length - 1;
const roadLength_4_2 = 1;
for (let i = 1; i < roadLength_4_2 + 1; i++) // Поддорожка 4, часть 2
    road_3.push([road_2[lastIndex][0] + i, road_2[lastIndex][1], true]);



lastIndex = road_2.length - 1;
const roadLength_5 = 13;
for (let i = 1; i < roadLength_5 + 1; i++)  // Поддорожка 5
    road_3.push([road_2[lastIndex][0], road_2[lastIndex][1] + i, true]);



lastIndex = road_3.length - 1;
returnRow = road_3[lastIndex][0] + 7;
returnCol = road_3[lastIndex][1] + 1;

const roadLength_6 = 13;
for (let i = 1; i < roadLength_6 + 1; i++)  // Поддорожка 6
    road_4.push([returnRow, returnCol - i, true]);

lastIndex = road_4.length - 1;
road_4.push([road_4[lastIndex][0], road_4[lastIndex][1] - 1, false]);  // Точка поддорожки 6, пересечение со своей частью



lastIndex = road_4.length - 1;
road_5.push([road_4[lastIndex][0], road_4[lastIndex][1] - 1, true]); // Поддорожка 7

lastIndex = road_5.length - 1;
road_5.push([road_5[lastIndex][0], road_5[lastIndex][1] - 1, false]);   // Точка поддорожки 7, пересечение со своей частью




lastIndex = road_5.length - 1;
const roadLength_8 = 10;
for (let i = 1; i < roadLength_8 + 1; i++)                              // Поддорожка 8
    road_6.push([road_5[lastIndex][0], road_5[lastIndex][1] - i, true]);



lastIndex = road_5.length - 1;
road_7.push([road_5[lastIndex][0] - 1, road_5[lastIndex][1], true]);    // Поддорожка 9

lastIndex = road_7.length - 1;
road_7.push([road_7[lastIndex][0] - 1, road_7[lastIndex][1], false]);   // Поддорожка 9, пересечение со своей частью

lastIndex = road_2.length - 1;
const roadLength_10_1 = 1;
for (let i = 1; i < roadLength_10_1 + 1; i++)                           // Поддорожка 10, часть 1
    road_8.push([road_2[lastIndex][0] + i, road_2[lastIndex][1], true]);

lastIndex = road_8.length - 1;
road_8.push([road_8[lastIndex][0] + 1, road_8[lastIndex][1], false]);   // Пересечение поддорожки 10 с дорожкой СПП


lastIndex = road_8.length - 1;
const roadLength_10_2 = 4;
for (let i = 1; i < roadLength_10_2 + 1; i++)                             // Поддорожка 10, часть 1
    road_8.push([road_8[lastIndex][0] + i, road_8[lastIndex][1], true]);


lastIndex = road_8.length - 1;                                            // Поддорожка 10, пересечение со своей частью
road_8.push([road_8[lastIndex][0] + 1, road_8[lastIndex][1], false]);

function showRoads() {
    console.log("Дорога 1: ", road_1);
    console.log("Дорога 2: ", road_2);
    console.log("Дорога 3: ", road_3);
    console.log("Дорога 4: ", road_4);
    console.log("Дорога 5: ", road_5);
    console.log("Дорога 6: ", road_6);
    console.log("Дорога 7: ", road_7);
    console.log("Дорога 8: ", road_8);
}
// showRoads();

module.exports = {
    spawnRow, spawnCol,
    planeZoneRow, planeZoneCol,
    dispatchRow, dispatchCol,
    parkingSpots,
    returnRow, returnCol,
    road_1, road_2, road_3, road_4, road_5, road_6, road_7, road_8
};

