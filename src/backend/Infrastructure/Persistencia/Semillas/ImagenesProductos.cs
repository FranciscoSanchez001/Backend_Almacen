namespace Infrastructure.Persistencia.Semillas
{
    // Imágenes de demostración de los productos sembrados, por SKU. Son fotos libres de
    // Wikimedia Commons (dominio público, CC0, CC BY o CC BY-SA); los autores y las licencias
    // están en docs/CREDITOS_IMAGENES.md. Se enlazan por URL: no se guardan en el repositorio.
    internal static class ImagenesProductos
    {
        private const string Commons = "https://upload.wikimedia.org/wikipedia/commons/";

        public static readonly IReadOnlyDictionary<string, string> PorSku = new Dictionary<string, string>
        {
            ["BEB-0001"] = Commons + "thumb/e/ee/Coffee_powdered.jpg/500px-Coffee_powdered.jpg",
            ["BEB-0002"] = Commons + "thumb/e/e8/15-09-26-RalfR-WLC-0098_-_Coca-Cola_glass_bottle_%28Germany%29.jpg/500px-15-09-26-RalfR-WLC-0098_-_Coca-Cola_glass_bottle_%28Germany%29.jpg",
            ["BEB-0003"] = Commons + "thumb/b/b1/Bottled_water.jpg/500px-Bottled_water.jpg",
            ["BEB-0004"] = Commons + "thumb/6/67/Orange_juice_1_edit1.jpg/500px-Orange_juice_1_edit1.jpg",
            ["BEB-0005"] = Commons + "thumb/c/cb/Malta_Caracas.jpg/500px-Malta_Caracas.jpg",
            ["BEB-0006"] = Commons + "thumb/a/a1/Iced_lemon_tea_-_Rawlab_Juice_%26_Tea.jpg/500px-Iced_lemon_tea_-_Rawlab_Juice_%26_Tea.jpg",
            ["BEB-0007"] = Commons + "thumb/a/ac/Beer_cans.jpg/500px-Beer_cans.jpg",
            ["LAC-0001"] = Commons + "thumb/0/0e/Milk_glass.jpg/500px-Milk_glass.jpg",
            ["LAC-0002"] = Commons + "thumb/7/77/Queso_llanero.jpg/500px-Queso_llanero.jpg",
            ["LAC-0003"] = Commons + "thumb/8/83/Egg_cartons_with_chicken_eggs_03.jpg/500px-Egg_cartons_with_chicken_eggs_03.jpg",
            ["LAC-0004"] = Commons + "thumb/b/b8/Joghurt.jpg/500px-Joghurt.jpg",
            ["LAC-0005"] = Commons + "thumb/d/d7/Gouda_cheese_slices.jpg/500px-Gouda_cheese_slices.jpg",
            ["LAC-0006"] = Commons + "thumb/9/94/2023_Mas%C5%82o_w_maselniczce.jpg/500px-2023_Mas%C5%82o_w_maselniczce.jpg",
            ["LAC-0007"] = Commons + "8/8b/PowderedMilk.jpg",
            ["LAC-0008"] = Commons + "thumb/8/80/Sour_Cream.jpg/500px-Sour_Cream.jpg",
            ["LIM-0001"] = Commons + "thumb/7/7a/Plastic_spoon_n_Laundry_detergent_n_Washing_powder_in_white.jpg/500px-Plastic_spoon_n_Laundry_detergent_n_Washing_powder_in_white.jpg",
            ["LIM-0002"] = Commons + "b/b6/Bleach-bottle.jpg",
            ["LIM-0003"] = Commons + "thumb/5/53/A_bar_of_soap.jpg/500px-A_bar_of_soap.jpg",
            ["LIM-0004"] = Commons + "thumb/8/81/Joy_pot_and_pan_detergent.jpg/500px-Joy_pot_and_pan_detergent.jpg",
            ["LIM-0005"] = Commons + "thumb/c/cd/Toilet_paper_roll.jpg/500px-Toilet_paper_roll.jpg",
            ["LIM-0006"] = Commons + "thumb/0/02/Window_cleaner_and_an_empty_spray_bottle.jpg/500px-Window_cleaner_and_an_empty_spray_bottle.jpg",
            ["LIM-0007"] = Commons + "thumb/0/0c/Globus_Saarbr%C3%BCcken%2C_fabric_softener_pic1.JPG/500px-Globus_Saarbr%C3%BCcken%2C_fabric_softener_pic1.JPG",
            ["VIV-0001"] = Commons + "thumb/f/fb/Flour_mix_to_make_arepas.jpg/500px-Flour_mix_to_make_arepas.jpg",
            ["VIV-0002"] = Commons + "thumb/4/4b/Thai_jasmine_rice_uncooked.jpg/500px-Thai_jasmine_rice_uncooked.jpg",
            ["VIV-0003"] = Commons + "thumb/d/d4/Pasta.jpg/500px-Pasta.jpg",
            ["VIV-0004"] = Commons + "thumb/3/33/Bottle_1_liter_Sunflower_refined_oil.jpg/500px-Bottle_1_liter_Sunflower_refined_oil.jpg",
            ["VIV-0005"] = Commons + "thumb/3/31/Sugar_on_a_blue_plate_%28close_up%29.jpg/500px-Sugar_on_a_blue_plate_%28close_up%29.jpg",
            ["VIV-0006"] = Commons + "thumb/4/4f/BLACK_TURTLE_BEANS.jpg/500px-BLACK_TURTLE_BEANS.jpg",
            ["VIV-0007"] = Commons + "thumb/a/ad/Table_salt_with_salt_shaker_V1.jpg/500px-Table_salt_with_salt_shaker_V1.jpg",
            ["VIV-0008"] = Commons + "thumb/a/a7/Lata_de_at%C3%BAn-Albo.jpg/500px-Lata_de_at%C3%BAn-Albo.jpg",
            ["VIV-0009"] = Commons + "thumb/d/d6/Sardines_in_olive_oil_%26_tomato_sauce.JPG/500px-Sardines_in_olive_oil_%26_tomato_sauce.JPG",
            ["VIV-0010"] = Commons + "thumb/d/d3/Heinz_Tomato_Ketchup%2C_Canada_%28front%29%2C_2026-02-19.jpg/500px-Heinz_Tomato_Ketchup%2C_Canada_%28front%29%2C_2026-02-19.jpg",
            ["VIV-0011"] = Commons + "thumb/8/87/Mayonnaise_Jar_550x900.JPG/500px-Mayonnaise_Jar_550x900.JPG",
            ["VIV-0012"] = Commons + "thumb/9/97/Rolled_oats.jpg/500px-Rolled_oats.jpg",
            ["VIV-0013"] = Commons + "thumb/d/da/3_types_of_lentil.jpg/500px-3_types_of_lentil.jpg",
            ["VIV-0014"] = Commons + "thumb/5/5c/Margarine.jpg/500px-Margarine.jpg",
        };

        public static string? Para(string sku) => PorSku.GetValueOrDefault(sku);
    }
}
